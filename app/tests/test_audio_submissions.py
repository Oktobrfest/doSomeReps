import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask

class TestAudioQuizSubmissions(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SECRET_KEY'] = 'test-secret'

    @patch('repz.services.quiz_service._submit_quiz_answer')
    def test_handle_quiz_post_correct(self, mock_submit_quiz_answer):
        """Test that _handle_quiz_post processes a correct submission correctly."""
        # Setup request context with POST form data
        with self.app.test_request_context(
            method="POST",
            data={
                "correct_submit": "Correct!",
                "incorrect_submit": None,
                "quizq-id": "123",
                "provided-answer": "My correct answer",
                "start-quiz": None,
                "exclude-question-button": None,
                "apply-categories": None
            }
        ):
            from repz.services.quiz_service import _handle_quiz_post
            que_list = [{"quizq_id": 123, "categories": ["Python"]}]
            
            with patch('repz.services.quiz_service.redirect') as mock_redirect, \
                 patch('repz.services.quiz_service.url_for') as mock_url_for:
                
                mock_url_for.return_value = "/audio"
                _handle_quiz_post(
                    user_id=1,
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz",
                    selected_categories=["Python"]
                )

                # Assert _submit_quiz_answer was called with correct parameters
                from repz.services.quiz_service import AnswerVerdict
                mock_submit_quiz_answer.assert_called_once_with(
                    user_id=1,
                    quizq_id=123,
                    verdict=AnswerVerdict.CORRECT,
                    provided_answer="My correct answer",
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz"
                )
                mock_redirect.assert_called_once()

    @patch('repz.services.quiz_service._submit_quiz_answer')
    def test_handle_quiz_post_incorrect(self, mock_submit_quiz_answer):
        """Test that _handle_quiz_post processes an incorrect submission correctly."""
        # Setup request context with POST form data
        with self.app.test_request_context(
            method="POST",
            data={
                "correct_submit": None,
                "incorrect_submit": "Wrong!",
                "quizq-id": "456",
                "provided-answer": "My incorrect answer",
                "start-quiz": None,
                "exclude-question-button": None,
                "apply-categories": None
            }
        ):
            from repz.services.quiz_service import _handle_quiz_post
            que_list = [{"quizq_id": 456, "categories": ["Python"]}]
            
            with patch('repz.services.quiz_service.redirect') as mock_redirect, \
                 patch('repz.services.quiz_service.url_for') as mock_url_for:
                
                mock_url_for.return_value = "/audio"
                _handle_quiz_post(
                    user_id=1,
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz",
                    selected_categories=["Python"]
                )

                # Assert _submit_quiz_answer was called with incorrect parameters
                from repz.services.quiz_service import AnswerVerdict
                mock_submit_quiz_answer.assert_called_once_with(
                    user_id=1,
                    quizq_id=456,
                    verdict=AnswerVerdict.WRONG,
                    provided_answer="My incorrect answer",
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz"
                )
                mock_redirect.assert_called_once()

    @patch('repz.services.quiz_service._submit_quiz_answer')
    def test_handle_quiz_post_slightly_wrong(self, mock_submit_quiz_answer):
        """Test that _handle_quiz_post processes a slightly wrong submission correctly."""
        # Setup request context with POST form data
        with self.app.test_request_context(
            method="POST",
            data={
                "correct_submit": None,
                "incorrect_submit": "Slightly Wrong",
                "quizq-id": "789",
                "provided-answer": "My slightly wrong answer",
                "start-quiz": None,
                "exclude-question-button": None,
                "apply-categories": None
            }
        ):
            from repz.services.quiz_service import _handle_quiz_post
            que_list = [{"quizq_id": 789, "categories": ["Python"]}]
            
            with patch('repz.services.quiz_service.redirect') as mock_redirect, \
                 patch('repz.services.quiz_service.url_for') as mock_url_for:
                
                mock_url_for.return_value = "/audio"
                _handle_quiz_post(
                    user_id=1,
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz",
                    selected_categories=["Python"]
                )

                # Assert _submit_quiz_answer was called with correct parameters for slightly wrong
                from repz.services.quiz_service import AnswerVerdict
                mock_submit_quiz_answer.assert_called_once_with(
                    user_id=1,
                    quizq_id=789,
                    verdict=AnswerVerdict.SLIGHTLY_WRONG,
                    provided_answer="My slightly wrong answer",
                    que_list=que_list,
                    que_cache_key="test_cache_key",
                    endpoint_name="audio.audio_quiz"
                )
                mock_redirect.assert_called_once()
