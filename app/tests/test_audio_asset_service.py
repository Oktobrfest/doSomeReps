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

class TestAudioAssetServiceMultiLanguage(unittest.TestCase):
    def setUp(self):
        self.tts_client = MagicMock()
        self.storage_client = MagicMock()
        with patch('repz.services.audio_asset_service.session') as mock_session:
            self.mock_session = mock_session
            self.service = AudioAssetService(self.tts_client, self.storage_client)

    @patch('repz.services.audio_asset_service.session')
    @patch.object(AudioAssetService, '_generate_tts_texts')
    @patch.object(AudioAssetService, 'ensure_audio')
    def test_ensure_audio_for_quiz_question_multiple_languages(self, mock_ensure_audio, mock_generate_tts, mock_session):
        # Mock database query to return None (no existing audios)
        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_scalar

        # Mock user languages
        mock_lang1 = MagicMock()
        mock_lang1.language = "en_US"
        mock_lang2 = MagicMock()
        mock_lang2.language = "fr_FR"
        mock_user = MagicMock()
        mock_user.languages = [mock_lang1, mock_lang2]

        mock_generate_tts.side_effect = lambda q, lang, user: {
            "question": f"TTS q in {lang}",
            "answer": f"TTS a in {lang}"
        }

        mock_ensure_audio.side_effect = lambda question_id, part, text, language, tts_text: f"url_{language}_{part}"

        q = {
            "question_id": 456,
            "question_text": "Original question text",
            "answer": "Original answer text",
            "hint": None
        }

        # Call the method
        result = self.service.ensure_audio_for_quiz_question(
            q=q,
            language="en_US",
            user=mock_user,
            parts=("question", "answer")
        )

        # Check that it generated and ensured assets for both languages
        # _generate_tts_texts should be called once for each language
        self.assertEqual(mock_generate_tts.call_count, 2)
        mock_generate_tts.assert_any_call(q, "en_US", mock_user)
        mock_generate_tts.assert_any_call(q, "fr_FR", mock_user)

        # ensure_audio should be called 4 times (2 parts * 2 languages)
        self.assertEqual(mock_ensure_audio.call_count, 4)
        mock_ensure_audio.assert_any_call(
            question_id=456, part="question", text="Original question text", language="en_US", tts_text="TTS q in en_US"
        )
        mock_ensure_audio.assert_any_call(
            question_id=456, part="question", text="Original question text", language="fr_FR", tts_text="TTS q in fr_FR"
        )

        # Should return assets of the primary/first language (en_US)
        self.assertEqual(result, {
            "question": "url_en_US_question",
            "answer": "url_en_US_answer"
        })

    @patch('repz.services.audio_asset_service.session')
    @patch.object(AudioAssetService, '_generate_tts_texts')
    @patch.object(AudioAssetService, 'ensure_audio')
    def test_ensure_audio_for_quiz_question_no_languages_fallback(self, mock_ensure_audio, mock_generate_tts, mock_session):
        # Mock database query to return None (no existing audios)
        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_scalar

        # Mock user with no languages
        mock_user = MagicMock()
        mock_user.languages = []

        mock_generate_tts.return_value = {
            "question": "TTS q",
            "answer": "TTS a"
        }
        mock_ensure_audio.side_effect = lambda question_id, part, text, language, tts_text: f"url_{language}_{part}"

        q = {
            "question_id": 456,
            "question_text": "Original question text",
            "answer": "Original answer text",
            "hint": None
        }

        # Call the method
        result = self.service.ensure_audio_for_quiz_question(
            q=q,
            language="de_DE",
            user=mock_user,
            parts=("question", "answer")
        )

        # It should fall back to "de_DE" passed as argument
        mock_generate_tts.assert_called_once_with(q, "de_DE", mock_user)
        self.assertEqual(mock_ensure_audio.call_count, 2)
        mock_ensure_audio.assert_any_call(
            question_id=456, part="question", text="Original question text", language="de_DE", tts_text="TTS q"
        )
        self.assertEqual(result, {
            "question": "url_de_DE_question",
            "answer": "url_de_DE_answer"
        })

if __name__ == '__main__':
    unittest.main()
