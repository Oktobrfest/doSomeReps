import unittest
import sys
import os
from unittest.mock import patch, MagicMock

from flask import Flask
from flask_login import LoginManager

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Create app and push app context BEFORE importing repz
app = Flask(__name__)
app.config['TESTING'] = True
app.config['SECRET_KEY'] = 'test-secret'
app.config['HOME_STATIC_FOLDER'] = 'static'
# Disable login protection during testing - flask-login automatically bypasses @login_required
app.config['LOGIN_DISABLED'] = True

# Initialize LoginManager to prevent AttributeError: 'Flask' object has no attribute 'login_manager'
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    user = MagicMock()
    user.id = int(user_id)
    user.is_authenticated = True
    user.is_active = True
    user.is_anonymous = False
    return user

ctx = app.app_context()
ctx.push()

# Mock the decorators and dependencies
from repz.ai.question_generator import (
    ai_qgen_state,
    ai_qgen_generate,
    ai_qgen_save_one,
    ai_qgen_save_all,
    ai_qgen_delete_one,
    ai_qgen_delete_all,
    ai_qgen_extend_one,
    ai_qgen_extend_all,
)


class TestAIQuestionGeneratorAPIs(unittest.TestCase):
    def setUp(self):
        self.app = app
        
        # Register routes directly on the test app so we can test them via the Flask test client
        try:
            self.app.add_url_rule("/ai_question_generator/api/state", "state", ai_qgen_state, methods=["GET"])
            self.app.add_url_rule("/ai_question_generator/api/generate", "generate", ai_qgen_generate, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/save", "save", ai_qgen_save_one, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/save_all", "save_all", ai_qgen_save_all, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/delete", "delete", ai_qgen_delete_one, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/delete_all", "delete_all", ai_qgen_delete_all, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/extend", "extend", ai_qgen_extend_one, methods=["POST"])
            self.app.add_url_rule("/ai_question_generator/api/extend_all", "extend_all", ai_qgen_extend_all, methods=["POST"])
        except AssertionError:
            # Already added, ignore
            pass
        
        self.client = self.app.test_client()
        self.req_ctx = self.app.test_request_context()
        self.req_ctx.push()

    def tearDown(self):
        self.req_ctx.pop()

    @patch("repz.ai.question_generator.current_user")
    @patch("repz.ai.question_generator.get_session")
    def test_state_endpoint(self, mock_get_session, mock_current_user):
        mock_current_user.id = 1
        mock_current_user.is_authenticated = True
        mock_get_session.return_value = ["Math", "Science"]
        
        with self.client.session_transaction() as sess:
            sess["_user_id"] = "1"
            sess["ai_qgen_generated_questions"] = [
                {"question": "Q1", "hint": "H1", "answer": "A1", "categories": ["Math"]}
            ]
            
        response = self.client.get("/ai_question_generator/api/state")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data["generated_questions"]), 1)
        self.assertEqual(data["generated_questions"][0]["question"], "Q1")
        self.assertEqual(data["selected_categories"], ["Math", "Science"])

    @patch("repz.ai.question_generator.current_user")
    def test_generate_endpoint_validation(self, mock_current_user):
        mock_current_user.id = 1
        mock_current_user.is_authenticated = True
        
        with self.client.session_transaction() as sess:
            sess["_user_id"] = "1"
            
        # Missing quiz content
        response = self.client.post("/ai_question_generator/api/generate", json={
            "categories": ["Math"]
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("content is required", response.get_json()["error"])

        # Missing categories
        response = self.client.post("/ai_question_generator/api/generate", json={
            "quiz_content": "some text"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("category is required", response.get_json()["error"])

    @patch("repz.ai.question_generator.current_user")
    @patch("repz.ai.question_generator.generate_questions")
    @patch("repz.ai.question_generator.set_session")
    def test_generate_endpoint_success(self, mock_set_session, mock_generate, mock_current_user):
        mock_current_user.id = 1
        mock_current_user.is_authenticated = True
        mock_generate.return_value = [
            {"question": "Gen Q", "hint": None, "answer": "Gen A", "categories": ["Math"]}
        ]
        
        with self.client.session_transaction() as sess:
            sess["_user_id"] = "1"
            
        response = self.client.post("/ai_question_generator/api/generate", json={
            "quiz_content": "source text",
            "categories": ["Math"],
            "qty_from": 1,
            "qty_to": 5,
            "try_provide_hints": False
        })
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["generated_questions"]), 1)
        self.assertEqual(data["generated_questions"][0]["question"], "Gen Q")

    @patch("repz.ai.question_generator.current_user")
    def test_delete_and_delete_all_endpoints(self, mock_current_user):
        mock_current_user.id = 1
        mock_current_user.is_authenticated = True
        
        with self.client.session_transaction() as sess:
            sess["_user_id"] = "1"
            sess["ai_qgen_generated_questions"] = [
                {"question": "Q1", "hint": "H1", "answer": "A1", "categories": ["Math"]},
                {"question": "Q2", "hint": "H2", "answer": "A2", "categories": ["Science"]}
            ]
            
        # Delete index 0
        response = self.client.post("/ai_question_generator/api/delete", json={"index": 0})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["generated_questions"]), 1)
        self.assertEqual(data["generated_questions"][0]["question"], "Q2")

        # Delete all
        response = self.client.post("/ai_question_generator/api/delete_all")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["generated_questions"]), 0)


if __name__ == "__main__":
    unittest.main()
