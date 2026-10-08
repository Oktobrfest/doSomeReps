import os
import sys
import unittest
from unittest.mock import patch

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from repz.services import quiz_service  # noqa: E402
from tests.test_question_service import FakeSession  # noqa: E402


class GuideTestCase(unittest.TestCase):
    """Runs a guide function against queued query results, with writes mocked."""

    def _run(self, function, *results):
        with patch.object(quiz_service, 'session', FakeSession(*results)), \
             patch.object(quiz_service, 'create_brand_new_quizq') as self.queue, \
             patch.object(quiz_service, 'set_selected_categories') as self.select_categories, \
             patch.object(quiz_service, 'invalidate_quiz_queue_cache') as self.invalidate:
            return function(7)


class TestStartGuideForNewUser(GuideTestCase):
    """A reader who has never queued a question starts on the first guide question."""

    def test_new_reader_is_queued_the_first_guide_question(self):
        started = self._run(
            quiz_service.start_guide_for_new_user, [], [11], [], ['Site Guide']
        )

        self.assertTrue(started)
        self.queue.assert_called_once_with([11], 7)
        self.select_categories.assert_called_once_with(['Site_Guide'])

    def test_reader_with_quiz_history_is_left_alone(self):
        started = self._run(quiz_service.start_guide_for_new_user, [101])

        self.assertFalse(started)
        self.queue.assert_not_called()
        self.select_categories.assert_not_called()

    def test_nothing_happens_without_guide_questions(self):
        started = self._run(quiz_service.start_guide_for_new_user, [], [])

        self.assertFalse(started)
        self.queue.assert_not_called()
        self.select_categories.assert_not_called()


class TestContinueGuide(GuideTestCase):
    """Finishing a guide question queues the one after it, and only that one."""

    def _continue(self, *results):
        self._run(lambda user_id: quiz_service.continue_guide(user_id, 500), *results)

    def test_finishing_a_guide_question_queues_the_next(self):
        self._continue([11], [12], [])

        self.queue.assert_called_once_with([12], 7)
        self.invalidate.assert_called_once_with(7)

    def test_next_question_already_queued_is_not_skipped_past(self):
        self._continue([11], [12], [900])

        self.queue.assert_not_called()

    def test_other_questions_leave_the_guide_alone(self):
        self._continue([])

        self.queue.assert_not_called()
        self.invalidate.assert_not_called()


if __name__ == '__main__':
    unittest.main()
