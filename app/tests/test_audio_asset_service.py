import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Add the parent directory of 'repz' to the Python path
# The file is in app/tests/test_audio_asset_service.py
# 'repz' is in app/repz
# So we need to add 'app' to the path.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from repz.services.audio_asset_service import AudioAssetService

class TestAudioAssetServiceGenerateTTS(unittest.TestCase):
    def setUp(self):
        self.tts_client = MagicMock()
        self.storage_client = MagicMock()
        # Mock session to avoid database connection issues during initialization if any
        with patch('repz.services.audio_asset_service.session'):
            self.service = AudioAssetService(self.tts_client, self.storage_client)
        self.mock_user = MagicMock()

    @patch('repz.services.audio_asset_service.completion_for_user')
    def test_generate_tts_texts_success(self, mock_completion):
        # Setup mock response
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "question": "TTS question",
                            "answer": "TTS answer",
                            "hint": "TTS hint"
                        })
                    }
                }
            ]
        }
        mock_completion.return_value = mock_response

        q = {
            "question_text": "Original question",
            "answer": "Original answer",
            "hint": "Original hint",
            "question_id": 123
        }
        language = "en-US"

        result = self.service._generate_tts_texts(q, language, self.mock_user)

        self.assertEqual(result["question"], "TTS question")
        self.assertEqual(result["answer"], "TTS answer")
        self.assertEqual(result["hint"], "TTS hint")
        
        # Verify prompt content contains the original texts
        args, kwargs = mock_completion.call_args
        messages = args[1]
        prompt = messages[0]["content"]
        self.assertIn("Original question", prompt)
        self.assertIn("Original answer", prompt)
        self.assertIn("Original hint", prompt)
        self.assertIn("en-US", prompt)

    @patch('repz.services.audio_asset_service.completion_for_user')
    def test_generate_tts_texts_fallback_on_exception(self, mock_completion):
        mock_completion.side_effect = Exception("AI Error")

        q = {
            "question_text": "Original question",
            "answer": "Original answer",
            "hint": "Original hint",
            "question_id": 123
        }
        language = "en-US"

        # Should not raise exception, but return fallback
        result = self.service._generate_tts_texts(q, language, self.mock_user)

        self.assertEqual(result["question"], "Original question")
        self.assertEqual(result["answer"], "Original answer")
        self.assertEqual(result["hint"], "Original hint")

    @patch('repz.services.audio_asset_service.completion_for_user')
    def test_generate_tts_texts_fallback_on_invalid_json(self, mock_completion):
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": "Not a JSON object"
                    }
                }
            ]
        }
        mock_completion.return_value = mock_response

        q = {
            "question_text": "Original question",
            "answer": "Original answer",
            "hint": "Original hint",
            "question_id": 123
        }
        language = "en-US"

        result = self.service._generate_tts_texts(q, language, self.mock_user)

        self.assertEqual(result["question"], "Original question")
        self.assertEqual(result["answer"], "Original answer")
        self.assertEqual(result["hint"], "Original hint")

    @patch('repz.services.audio_asset_service.completion_for_user')
    def test_generate_tts_texts_missing_fields_in_q(self, mock_completion):
        # Test when some fields are missing in the input question dict
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "question": "TTS question",
                            "answer": "",
                            "hint": ""
                        })
                    }
                }
            ]
        }
        mock_completion.return_value = mock_response

        q = {
            "question_id": 123
            # question_text, answer, hint are missing
        }
        language = "en-US"

        result = self.service._generate_tts_texts(q, language, self.mock_user)

        self.assertEqual(result["question"], "TTS question")
        self.assertEqual(result["answer"], "")
        self.assertEqual(result["hint"], "")

        # Check fallback when missing fields and AI fails
        mock_completion.side_effect = Exception("AI Error")
        result = self.service._generate_tts_texts(q, language, self.mock_user)
        self.assertIsNone(result["question"]) # q.get("question_text") is None
        self.assertIsNone(result["answer"])
        self.assertIsNone(result["hint"])

if __name__ == '__main__':
    unittest.main()
