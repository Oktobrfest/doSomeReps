"""AI Question Generator page.

Lets a user paste source material ("quiz content"), pick a desired
question-count range, and have the AI generate a batch of basic
question/answer pairs about it. The user will then later be able to
ask the AI to "extend" any of those into a deeper answer.

Receiving / parsing of the AI response is intentionally NOT wired up
yet - this module only assembles the prompt and sends it. The results
section on the page is currently just a placeholder.
"""

from typing import List

from flask import flash, render_template, request
from flask_login import current_user, login_required
from pydantic import BaseModel, Field

from repz.routes import ai

from ..bluehelpers import get_all_categories, get_session, set_session
from .litellm_client import AIConfigError, completion_for_user
from .question_generator_forms import AIQuestionGenForm


# --- Prompt template -------------------------------------------------
#
# The user-supplied "quiz content" is appended to the END of this
# template before being sent to the AI. The selected categories are
# also injected so the AI can tag generated questions appropriately.
QUESTION_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that creates short, basic study questions and
answers from supplied source material, for use in a spaced-repetition
quiz app.

Generate between {qty_from} and {qty_to} question/answer pairs total.

Each question should:
- Be short, clear, and self-contained.
- Have a brief, factual answer (one or two sentences). The user will
  later be able to ask you to "extend" any answer into a longer,
  more in-depth explanation, so keep these initial answers compact.
- Be tagged with one or more categories from the user-selected list
  below. EVERY generated question MUST include at least one category
  from that list (never zero). A question can have multiple
  categories when more than one applies. You decide which of the
  user-selected categories best fit each question. Do NOT invent new
  categories or use any value outside the user-selected list.

User-selected categories (choose one or more for each question, from
this list only): {categories}

Source material follows below. Generate questions strictly about this
material:

---
"""


# --- Pydantic schema for the AI response -----------------------------
#
# Defined now so the same shape can be reused when we wire up response
# parsing later. It's also passed to the model as the expected
# `response_format` so the provider can return structured output.
class GeneratedQA(BaseModel):
    question: str = Field(..., description="The quiz question text.")
    answer: str = Field(..., description="A short, factual answer.")
    # `min_length=1` enforces "each question must have at least one
    # category" at the schema level, so providers that honor JSON
    # Schema constraints will refuse to emit a Q&A with zero tags.
    categories: List[str] = Field(
        ...,
        min_length=1,
        description=(
            "One or more categories chosen from the user-selected list. "
            "Must contain at least one entry; never empty."
        ),
    )


class GeneratedQuestionSet(BaseModel):
    questions: List[GeneratedQA]


@ai.route(
    "/ai_question_generator",
    methods=["GET", "POST"],
    endpoint="question_generator",
)
@login_required
def question_generator():
    """Render the AI Question Generator page and dispatch the prompt."""
    form = AIQuestionGenForm()
    category_list = get_all_categories()

    # Categories selected via the shared categories.html partial come
    # in as repeated `category_name` form fields (same convention as
    # the quiz / quemore pages). On GET we fall back to whatever the
    # user last had selected in the session.
    if request.method == "POST":
        selected_categories = request.form.getlist("category_name")
        set_session("ai_qgen_category_names", selected_categories)
    else:
        selected_categories = get_session("ai_qgen_category_names")
        if selected_categories == "Not set":
            selected_categories = []

    ai_error = None

    if form.validate_on_submit():
        # Categories are a hard requirement: the AI needs them to tag
        # every generated question, so block submission if none were
        # selected. This is enforced server-side here (rather than via
        # a WTForms validator) because the categories partial isn't a
        # WTForms field on this form.
        if not selected_categories:
            flash(
                "Please select at least one category - the AI uses these "
                "to tag every generated question.",
                category="error",
            )
            return render_template(
                "ai_question_generator.html",
                title="AI Question Generator",
                description="Have AI generate quiz questions from your material.",
                user=current_user,
                form=form,
                category_list=category_list,
                selected_categories=selected_categories,
                ai_error=None,
            )

        # Build the final prompt: template (with categories + range)
        # followed by the user's pasted material.
        prompt_header = QUESTION_GENERATION_PROMPT_TEMPLATE.format(
            qty_from=form.qty_from.data,
            qty_to=form.qty_to.data,
            categories=", ".join(selected_categories),
        )
        full_prompt = prompt_header + (form.quiz_content.data or "")

        messages = [{"role": "user", "content": full_prompt}]

        # Fire the request. We deliberately don't do anything with the
        # response yet - that wiring happens in a follow-up task.
        try:
            completion_for_user(
                current_user,
                messages=messages,
                response_format=GeneratedQuestionSet,
            )
        except AIConfigError as e:
            ai_error = str(e)
        except Exception as e:  # noqa: BLE001 - surface any provider error
            ai_error = f"AI request failed: {e}"

    return render_template(
        "ai_question_generator.html",
        title="AI Question Generator",
        description="Have AI generate quiz questions from your material.",
        user=current_user,
        form=form,
        category_list=category_list,
        selected_categories=selected_categories,
        ai_error=ai_error,
    )
