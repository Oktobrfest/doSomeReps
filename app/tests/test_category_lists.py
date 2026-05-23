import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from repz.models import Base, users, category, category_lists

class TestCategoryListsModel(unittest.TestCase):
    def setUp(self):
        # Create an in-memory SQLite database for testing
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.session = self.Session()

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_create_category_list(self):
        # 1. Create a user
        test_user = users(
            username="testuser",
            email="test@example.com",
            password="hashed_password"
        )
        self.session.add(test_user)
        self.session.commit()

        # 2. Create some categories
        cat1 = category(category_name="Python", created_by=test_user.id)
        cat2 = category(category_name="Database", created_by=test_user.id)
        cat3 = category(category_name="Docker", created_by=test_user.id)
        self.session.add_all([cat1, cat2, cat3])
        self.session.commit()

        # 3. Create a category list
        cat_list = category_lists(
            user_id=test_user.id,
            category_list_name="My Tech Stack",
            is_default=True
        )
        cat_list.categories.append(cat1)
        cat_list.categories.append(cat2)
        
        self.session.add(cat_list)
        self.session.commit()

        # 4. Query and assert
        queried_list = self.session.query(category_lists).filter_by(id=cat_list.id).first()
        self.assertIsNotNone(queried_list)
        self.assertEqual(queried_list.category_list_name, "My Tech Stack")
        self.assertTrue(queried_list.is_default)
        self.assertEqual(queried_list.user_id, test_user.id)
        
        # Verify many-to-many relationship with categories
        self.assertEqual(len(queried_list.categories), 2)
        category_names = [c.category_name for c in queried_list.categories]
        self.assertIn("Python", category_names)
        self.assertIn("Database", category_names)
        self.assertNotIn("Docker", category_names)

        # Verify one-to-many relationship with users
        queried_user = self.session.query(users).filter_by(id=test_user.id).first()
        self.assertEqual(len(queried_user.category_lists), 1)
        self.assertEqual(queried_user.category_lists[0].category_list_name, "My Tech Stack")

    def test_multiple_category_lists(self):
        test_user = users(
            username="testuser",
            email="test@example.com",
            password="hashed_password"
        )
        self.session.add(test_user)
        self.session.commit()

        # Create numerous saved lists of categories
        list1 = category_lists(
            user_id=test_user.id,
            category_list_name="List 1",
            is_default=False
        )
        list2 = category_lists(
            user_id=test_user.id,
            category_list_name="List 2",
            is_default=True
        )
        
        self.session.add_all([list1, list2])
        self.session.commit()

        queried_user = self.session.query(users).filter_by(id=test_user.id).first()
        self.assertEqual(len(queried_user.category_lists), 2)
        
        # Check which is designated as default
        default_lists = [l for l in queried_user.category_lists if l.is_default]
        self.assertEqual(len(default_lists), 1)
        self.assertEqual(default_lists[0].category_list_name, "List 2")

    def test_cascade_delete_user(self):
        # Create a user and a list
        test_user = users(
            username="testuser",
            email="test@example.com",
            password="hashed_password"
        )
        self.session.add(test_user)
        self.session.commit()

        cat_list = category_lists(
            user_id=test_user.id,
            category_list_name="Temporary List",
            is_default=False
        )
        self.session.add(cat_list)
        self.session.commit()

        # Delete the user
        self.session.delete(test_user)
        self.session.commit()

        # Check that the category list is deleted too (cascade)
        queried_list = self.session.query(category_lists).filter_by(id=cat_list.id).first()
        self.assertIsNone(queried_list)
