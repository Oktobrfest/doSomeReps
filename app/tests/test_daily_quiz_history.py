import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask


class TestDailyQuizHistory(unittest.TestCase):
    def test_empty_history(self):
        from repz.services.quiz_service import get_daily_quiz_history

        with patch("repz.services.quiz_service.session") as mock_session:
            mock_session.execute.return_value.all.return_value = []
            history = get_daily_quiz_history(14)
            self.assertEqual(history, [])

    def test_grouped_history(self):
        from repz.services.quiz_service import get_daily_quiz_history

        mock_rows = [
            (date(2026, 10, 18), True, "Python", 3),
            (date(2026, 10, 18), True, "SQL", 2),
            (date(2026, 10, 18), False, "Python", 1),
            (date(2026, 10, 19), True, "Docker", 5),
            (date(2026, 10, 19), False, "Docker", 2),
            (date(2026, 10, 19), False, "Linux", 1),
        ]
        with patch("repz.services.quiz_service.session") as mock_session:
            mock_session.execute.return_value.all.return_value = mock_rows
            history = get_daily_quiz_history(14)
            self.assertEqual(len(history), 2)
            # Day 1: 2026-10-18
            day1 = history[0]
            self.assertEqual(day1["date"], "2026-10-18")
            self.assertEqual(day1["totalCorrect"], 5)
            self.assertEqual(day1["totalIncorrect"], 1)
            self.assertEqual(day1["correct"], {"Python": 3, "SQL": 2})
            self.assertEqual(day1["incorrect"], {"Python": 1})

            # Day 2: 2026-10-19
            day2 = history[1]
            self.assertEqual(day2["date"], "2026-10-19")
            self.assertEqual(day2["totalCorrect"], 5)
            self.assertEqual(day2["totalIncorrect"], 3)
            self.assertEqual(day2["correct"], {"Docker": 5})
            self.assertEqual(day2["incorrect"], {"Docker": 2, "Linux": 1})

    def test_api_daily_quiz_history_endpoint(self):
        from repz.home import quiz_api

        app = Flask(__name__)
        with app.test_request_context(), \
             patch("repz.home.quiz_api.current_user", SimpleNamespace(id=14)), \
             patch("repz.home.quiz_api.get_daily_quiz_history", return_value=[{"date": "2026-10-19"}]) as mock_fn:
            response = quiz_api.api_daily_quiz_history.__wrapped__()
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data["ok"])
            self.assertEqual(data["history"], [{"date": "2026-10-19"}])
            mock_fn.assert_called_once_with(14)
