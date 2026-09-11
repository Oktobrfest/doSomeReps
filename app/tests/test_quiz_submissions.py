import unittest
from types import SimpleNamespace
from unittest.mock import patch
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask


class TestQuizSubmissions(unittest.TestCase):
    """
    The quiz SPA reports verdicts through /quiz/api/action, so these cover the
    JSON handler rather than the form POST it replaced.
    """

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SECRET_KEY'] = 'test-secret'

    def _post_action(self, payload):
        """Run quiz_action against a request carrying `payload`, with IO mocked out."""
        from repz.home import quiz_api
        from repz.services.quiz_service import AnswerVerdict

        with self.app.test_request_context(method="POST", json=payload):
            with patch.object(quiz_api, 'current_user', SimpleNamespace(id=1)), \
                 patch.object(quiz_api, 'get_selected_categories') as mock_categories, \
                 patch.object(quiz_api, 'CacheHelper') as mock_cache_helper, \
                 patch.object(quiz_api, 'submit_quiz_answer') as mock_submit, \
                 patch.object(quiz_api, 'exclude_quiz_question') as mock_exclude:

                mock_categories.return_value = ["Python"]

                que_list = [{"quizq_id": 123, "categories": ["Python"]}]
                mock_cache_helper.return_value.get_cached_questions.return_value = (
                    que_list,
                    "test_cache_key",
                )

                response = quiz_api.quiz_action.__wrapped__()

                return {
                    "response": response,
                    "submit": mock_submit,
                    "exclude": mock_exclude,
                    "que_list": que_list,
                    "AnswerVerdict": AnswerVerdict,
                }

    def test_correct_submission(self):
        result = self._post_action({
            "action": "submit",
            "quizqId": 123,
            "verdict": "Correct!",
            "providedAnswer": "My correct answer",
        })

        result["submit"].assert_called_once_with(
            user_id=1,
            quizq_id=123,
            verdict=result["AnswerVerdict"].CORRECT,
            provided_answer="My correct answer",
            que_list=result["que_list"],
            que_cache_key="test_cache_key",
        )

    def test_wrong_submission(self):
        result = self._post_action({
            "action": "submit",
            "quizqId": 456,
            "verdict": "Wrong!",
            "providedAnswer": "My incorrect answer",
        })

        result["submit"].assert_called_once_with(
            user_id=1,
            quizq_id=456,
            verdict=result["AnswerVerdict"].WRONG,
            provided_answer="My incorrect answer",
            que_list=result["que_list"],
            que_cache_key="test_cache_key",
        )

    def test_slightly_wrong_submission(self):
        result = self._post_action({
            "action": "submit",
            "quizqId": 789,
            "verdict": "Slightly Wrong",
            "providedAnswer": "My slightly wrong answer",
        })

        result["submit"].assert_called_once_with(
            user_id=1,
            quizq_id=789,
            verdict=result["AnswerVerdict"].SLIGHTLY_WRONG,
            provided_answer="My slightly wrong answer",
            que_list=result["que_list"],
            que_cache_key="test_cache_key",
        )

    def test_exclusion(self):
        result = self._post_action({"action": "exclude", "quizqId": 123})

        result["exclude"].assert_called_once_with(
            user_id=1,
            quizq_id=123,
            que_list=result["que_list"],
            que_cache_key="test_cache_key",
        )
        result["submit"].assert_not_called()

    def test_unknown_verdict_is_rejected(self):
        result = self._post_action({
            "action": "submit",
            "quizqId": 123,
            "verdict": "Maybe?",
        })

        _, status = result["response"]
        self.assertEqual(status, 400)
        result["submit"].assert_not_called()

    def test_missing_quizq_id_is_rejected(self):
        result = self._post_action({"action": "submit", "verdict": "Correct!"})

        _, status = result["response"]
        self.assertEqual(status, 400)
        result["submit"].assert_not_called()


if __name__ == '__main__':
    unittest.main()
