import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from repz.services.question_service import (  # noqa: E402
    MAX_ANSWER,
    QuestionDraft,
    QuestionValidationError,
    create_question,
    question_payload,
    resolve_categories,
)


def draft(**overrides):
    payload = {
        'question_text': 'Which service writes a question?',
        'hint': '',
        'answer': 'This one.',
        'categories': ['Math'],
    }
    payload.update(overrides)
    return QuestionDraft.from_payload(payload)


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeSession:
    """Answers each `execute` from a queue, and counts what was written."""

    def __init__(self, *results):
        self.results = list(results)
        self.added = []
        self.commits = 0

    def execute(self, _statement):
        return FakeResult(self.results.pop(0) if self.results else [])

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1


class TestQuestionDraft(unittest.TestCase):
    """The one reading of the payload all three editors post."""

    def test_blank_hint_becomes_absent(self):
        self.assertIsNone(draft(hint='   ').hint)

    def test_text_is_trimmed(self):
        self.assertEqual(draft(answer='  spaced  ').answer, 'spaced')

    def test_short_question_is_rejected(self):
        with self.assertRaises(QuestionValidationError):
            draft(question_text='hi').validate()

    def test_missing_answer_is_rejected(self):
        with self.assertRaises(QuestionValidationError):
            draft(answer='').validate()

    def test_over_long_answer_is_rejected(self):
        with self.assertRaises(QuestionValidationError):
            draft(answer='x' * (MAX_ANSWER + 1)).validate()


class TestResolveCategories(unittest.TestCase):
    """A tag that does not exist is an error, never a silent drop."""

    def test_no_categories_is_rejected(self):
        with self.assertRaises(QuestionValidationError):
            resolve_categories([])

    def test_unknown_category_is_named(self):
        fake = FakeSession([SimpleNamespace(category_name='Math')])
        with patch('repz.services.question_service.session', fake):
            with self.assertRaises(QuestionValidationError) as caught:
                resolve_categories(['Math', 'Astro_Physics'])

        self.assertIn('Astro Physics', str(caught.exception))

    def test_underscored_names_resolve(self):
        row = SimpleNamespace(category_name='Astro Physics')
        fake = FakeSession([row])
        with patch('repz.services.question_service.session', fake):
            self.assertEqual(resolve_categories(['Astro_Physics']), [row])


class TestCreateQuestion(unittest.TestCase):
    def test_duplicate_question_text_is_rejected(self):
        # First execute resolves the category, second finds the duplicate.
        fake = FakeSession([SimpleNamespace(category_name='Math')], [(1,)])
        with patch('repz.services.question_service.session', fake):
            with self.assertRaises(QuestionValidationError):
                create_question(draft(), created_by=7, files_request=None)

        self.assertEqual(fake.commits, 0)
        self.assertEqual(fake.added, [])


class TestQuestionPayload(unittest.TestCase):
    """A stored question goes out in the shape the payload reader takes in."""

    def test_round_trips_through_the_draft_reader(self):
        stored = SimpleNamespace(
            question_id=3, question_text='Q?', hint='H', answer='A', privacy=False,
            categories=[SimpleNamespace(category_name='Math')], pics=[],
        )
        payload = question_payload(stored)

        self.assertEqual(payload['id'], 3)
        self.assertEqual(QuestionDraft.from_payload(payload), draft(
            question_text='Q?', hint='H', answer='A', categories=['Math']))

    def test_pictures_are_grouped_by_part(self):
        stored = SimpleNamespace(
            question_id=3, question_text='Q?', hint=None, answer='A', privacy=False,
            categories=[],
            pics=[
                SimpleNamespace(pic_type='answer_pics', pic_string='a.png', pic_id=1),
                SimpleNamespace(pic_type='hint_image', pic_string='h.png', pic_id=2),
            ],
        )

        self.assertEqual(question_payload(stored)['pics_by_type'], {
            'question': [],
            'hint': [{'pic_string': 'h.png', 'pic_id': 2}],
            'answer': [{'pic_string': 'a.png', 'pic_id': 1}],
        })


if __name__ == '__main__':
    unittest.main()
