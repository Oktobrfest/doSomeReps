import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class FakeQuery:
    """Records what a view filtered on, and answers with a canned row."""

    def __init__(self, result):
        self.result = result
        self.criteria = []
        self.loader_options = []

    def options(self, *options):
        self.loader_options.extend(options)
        return self

    def filter(self, *criteria):
        self.criteria.extend(criteria)
        return self

    def first(self):
        return self.result


class FakeSession:
    def __init__(self, result=None):
        self.query_obj = FakeQuery(result)
        self.deleted = []
        self.commits = 0

    def query(self, *_entities):
        return self.query_obj

    def delete(self, obj):
        self.deleted.append(obj)

    def commit(self):
        self.commits += 1


def criteria_sql(fake_session):
    return [str(c) for c in fake_session.query_obj.criteria]


class TestOwnedQuestionLookup(unittest.TestCase):
    """`_owned_question` is the single gate both editors go through."""

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True

    def _lookup(self, result, *options):
        from repz.ajax.quest_ajx import quest_ajx as module

        fake_session = FakeSession(result)
        with self.app.test_request_context():
            with patch.object(module, 'session', fake_session), \
                 patch.object(module, 'current_user', SimpleNamespace(id=7)):
                found = module._owned_question(42, *options)
        return found, fake_session

    def test_filters_on_both_id_and_author(self):
        _, fake_session = self._lookup(None)
        sql = ' '.join(criteria_sql(fake_session))

        self.assertIn('question.question_id', sql)
        self.assertIn('question.created_by', sql)

    def test_returns_the_row_when_the_caller_owns_it(self):
        row = SimpleNamespace(question_id=42, created_by=7)
        found, _ = self._lookup(row)
        self.assertIs(found, row)

    def test_returns_none_when_someone_else_owns_it(self):
        found, _ = self._lookup(None)
        self.assertIsNone(found)


class TestSaveqOwnership(unittest.TestCase):
    """A forged question id must not reach the update."""

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True

    def _post(self, result):
        from repz.ajax.quest_ajx import quest_ajx as module

        payload = {
            'id': 42,
            'question_text': 'Whose question is this?',
            'hint': '',
            'answer': 'Not yours.',
            'privacy': False,
            'categories': [],
            'pics_by_type': {'hint': [], 'answer': [], 'question': []},
        }
        fake_session = FakeSession(result)

        with self.app.test_request_context(
            method='POST', data={'updated_question': json.dumps(payload)}
        ):
            with patch.object(module, 'session', fake_session), \
                 patch.object(module, 'current_user', SimpleNamespace(id=7)), \
                 patch.object(module, 'save_pictures') as save_pictures, \
                 patch.object(module, 'delete_pic') as delete_pic:
                response = module.saveq.__wrapped__()

        return response, fake_session, save_pictures, delete_pic

    def test_foreign_question_is_rejected(self):
        response, _, _, _ = self._post(None)
        _, status = response
        self.assertEqual(status, 404)

    def test_foreign_question_changes_nothing(self):
        _, fake_session, save_pictures, delete_pic = self._post(None)

        self.assertEqual(fake_session.commits, 0)
        save_pictures.assert_not_called()
        delete_pic.assert_not_called()

    def test_lookup_is_scoped_to_the_caller(self):
        _, fake_session, _, _ = self._post(None)
        self.assertIn(
            'question.created_by', ' '.join(criteria_sql(fake_session))
        )


class TestDeleteqOwnership(unittest.TestCase):
    """Same gate, and nothing may be removed from S3 before it passes."""

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True

    def _post(self, result):
        from repz.ajax.quest_ajx import quest_ajx as module

        fake_session = FakeSession(result)

        with self.app.test_request_context(method='POST', json={'id': 42}):
            with patch.object(module, 'session', fake_session), \
                 patch.object(module, 'current_user', SimpleNamespace(id=7)), \
                 patch.object(module, 'delete_pic') as delete_pic:
                response = module.deleteq.__wrapped__()

        return response, fake_session, delete_pic

    def test_foreign_question_is_rejected(self):
        response, _, _ = self._post(None)
        _, status = response
        self.assertEqual(status, 404)

    def test_foreign_question_is_not_deleted(self):
        _, fake_session, delete_pic = self._post(None)

        self.assertEqual(fake_session.deleted, [])
        self.assertEqual(fake_session.commits, 0)
        delete_pic.assert_not_called()

    def test_lookup_is_scoped_to_the_caller(self):
        _, fake_session, _ = self._post(None)
        self.assertIn(
            'question.created_by', ' '.join(criteria_sql(fake_session))
        )


if __name__ == '__main__':
    unittest.main()
