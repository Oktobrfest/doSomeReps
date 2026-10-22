import unittest
import base64
from io import BytesIO
from repz.charts import D3_COLOR_PALETTE, get_category_color_map, render_chart


class TestCategoryChartColors(unittest.TestCase):
    def test_color_map_with_daily_history(self):
        daily_history = [
            {
                "date": "2026-10-18",
                "correct": {"Python": 5, "SQL": 2},
                "incorrect": {"Python": 1},
                "totalCorrect": 7,
                "totalIncorrect": 1,
            },
            {
                "date": "2026-10-19",
                "correct": {"Docker": 10},
                "incorrect": {"SQL": 3},
                "totalCorrect": 10,
                "totalIncorrect": 3,
            },
        ]
        # Totals: Docker=10, Python=6, SQL=5
        color_map = get_category_color_map(daily_history)
        self.assertEqual(color_map["Docker"], D3_COLOR_PALETTE[0])
        self.assertEqual(color_map["Python"], D3_COLOR_PALETTE[1])
        self.assertEqual(color_map["SQL"], D3_COLOR_PALETTE[2])

    def test_color_map_deterministic_tie_breaking(self):
        # Two categories with identical answer counts
        daily_history = [
            {
                "date": "2026-10-19",
                "correct": {"Zebra": 5, "Apple": 5},
                "incorrect": {},
                "totalCorrect": 10,
                "totalIncorrect": 0,
            }
        ]
        color_map = get_category_color_map(daily_history)
        # Ties are broken alphabetically: Apple before Zebra
        self.assertEqual(color_map["Apple"], D3_COLOR_PALETTE[0])
        self.assertEqual(color_map["Zebra"], D3_COLOR_PALETTE[1])

    def test_color_map_with_extra_categories(self):
        daily_history = [
            {
                "date": "2026-10-19",
                "correct": {"Math": 8},
                "incorrect": {},
                "totalCorrect": 8,
                "totalIncorrect": 0,
            }
        ]
        # Extra categories due today that have no history yet
        extra = ["Math", "Physics", "Chemistry"]
        color_map = get_category_color_map(daily_history, extra_categories=extra)
        # Math was in history -> palette[0]
        self.assertEqual(color_map["Math"], D3_COLOR_PALETTE[0])
        # Physics and Chemistry get subsequent colors
        self.assertEqual(color_map["Physics"], D3_COLOR_PALETTE[1])
        self.assertEqual(color_map["Chemistry"], D3_COLOR_PALETTE[2])

    def test_render_chart_with_custom_colors(self):
        categories = ["Math", "Physics", "Chemistry"]
        counts = [10, 5, 2]
        colors = [D3_COLOR_PALETTE[0], D3_COLOR_PALETTE[1], D3_COLOR_PALETTE[2]]

        chart_b64 = render_chart(categories, counts, "Categories", "Questions", colors=colors)
        self.assertIsInstance(chart_b64, str)
        self.assertGreater(len(chart_b64), 0)

        # Confirm it decodes to a valid PNG header
        raw_bytes = base64.b64decode(chart_b64)
        self.assertTrue(raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_render_chart_without_colors_backward_compatible(self):
        categories = ["Math", "Physics"]
        counts = [3, 1]
        chart_b64 = render_chart(categories, counts, "Categories", "Questions")
        self.assertIsInstance(chart_b64, str)
        raw_bytes = base64.b64decode(chart_b64)
        self.assertTrue(raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_render_chart_wide_layout_many_categories(self):
        # 12 categories to test wide figure scaling
        categories = [f"Cat_{i}" for i in range(12)]
        counts = [i + 1 for i in range(12)]
        colors = [D3_COLOR_PALETTE[i % len(D3_COLOR_PALETTE)] for i in range(12)]
        chart_b64 = render_chart(categories, counts, "Categories", "Questions", colors=colors)
        self.assertIsInstance(chart_b64, str)
        raw_bytes = base64.b64decode(chart_b64)
        self.assertTrue(raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_render_chart_single_category_proportions(self):
        # 1 category to test limit of ridiculousness bar width
        categories = ["SingleCategory"]
        counts = [7]
        colors = [D3_COLOR_PALETTE[0]]
        chart_b64 = render_chart(categories, counts, "Categories", "Questions", colors=colors)
        self.assertIsInstance(chart_b64, str)
        raw_bytes = base64.b64decode(chart_b64)
        self.assertTrue(raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"))
