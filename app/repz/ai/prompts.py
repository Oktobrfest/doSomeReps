# All AI prompts go here:
from typing import List, Optional
##### ASK AI PROMPTS: ######
SYSTEM_PROMPT = (
    "You are a tutor teaching a student.\n"
    "Guidelines:\n"
    "1. Answer the question clearly and concisely.\n"
    "2. If the transcript is unclear or too ambiguous to answer, ask one short "
    "clarifying question and stop.\n"
    "3. Keep explanations focused and digestible for spoken audio: short sentences, "
    "plain language, no Markdown, no tables, no code blocks or formulas.\n"
    "4. Note that the audio transcription may have garbled the words the student"
    " is saying. So if the question doesn't fit the overall question content, in that case try your best"
    " to interpert it based on question content"
)

ANSWER_SECTION_REVEALED = (
    "The user has already revealed the answer to this question, which is shown below. "
    "You may reference it to help explain, but keep coaching them to understand it.\n"
    "Answer:\n{answer}\n\n"
)

ANSWER_SECTION_NOT_REVEALED = (
    "The user has not revealed the answer yet. Do NOT state or reveal the answer "
    "unless they directly ask for it. Help them to think.\n\n"
)

USER_PROMPT = (
    "The student is currently studying this quiz question.\n\n"
    "Question:\n{question}\n\n"
    "Categories: {categories}\n\n"
    "{answer_section}"
    "The student's spoken question (transcribed) to you is:\n{transcript}\n\n"
    "Provide a short, spoken-friendly tutor response."
)
##### END ASK AI PROMPTS ######



# --- Hint generation prompt template --------------------------------
#
# Used ONLY when the user ticks the "Try to provide hints" checkbox.
# This is sent as a SEPARATE AI call after the question-generation
# call: it takes the previously-generated questions as input and asks
# the model to write hints for the ones that are difficult enough to
# warrant a hint. Easy/obvious questions should be returned with no
# hint (null), so we don't clutter trivial questions with redundant
# nudges.
#
# The list of questions (a JSON dump of the first call's output) is
# appended to the END of this template before sending.
HINT_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that writes optional study hints for quiz
questions. You will be given a list of
questions (with their answers).

For each question, decide whether the question is difficult enough
that a hint would actually help a learner who is stuck. ONLY produce
a hint when the question warrants one - if a question is easy,
straightforward, or its answer is obvious from the wording, return
no hint (null) for that item.

A hint is NOT:
- feedback or praise;
- an evaluation of a student's response;
- the answer;
- a restatement of the answer;
- a phrase such as "correct", "incorrect", "good job", or "try again".

When you do produce a hint:
- Keep it short (one sentence is ideal).
- Nudge the learner toward the answer without giving the answer
  away! If that's not possible then dont provide a hint at all
  for that question.
- Do not restate the answer or include the answer text.

Return one hint entry per input question, in the same order as the
input, so they can be matched up by position.

Questions to consider follow below (JSON):

---
"""


# --- Extend (per-question deeper-answer) prompt template ------------
#
# Used by the "Extend" / "Extend All" buttons on the Generated
# Questions section. Each call expands one question's answer into a
# more thorough, explanatory version while staying inside the
# question's existing topic/category. The user may optionally add
# free-text instructions in the "extend instructions" field next to
# the Extend button; those are interpolated into
# `{user_instructions_block}` (or it stays empty when none were
# supplied).
#
# The model is asked to return its result in a strict two-section
# layout (SHORT ANSWER / LONG ANSWER) so we can drop it back into the
# editable answer textarea unchanged. A hint may also be returned if
# the model thinks one would help.
EXTEND_PROMPT_TEMPLATE = """\
You are extending an existing study question's answer into a more
detailed, explanatory version, for use in a spaced-repetition quiz
app. Stay focused on the question and the topic / category it sits
in - do NOT deviate into unrelated material.

The topic is {categories}.

Question:
{question}

Current answer:
{current_answer}
{user_instructions_block}
Write a more detailed, explanatory answer for the question above.
Stick to the question and the topic; do not wander outside that
category.

Format your output EXACTLY in the following layout. Keep spacing
TIGHT between paragraphs within a section. Put a single blank line
between distinct sub-sections where applicable. Use the literal
labels shown below:

SHORT ANSWER:
[A concise summary answer. One to two sentences.]

LONG ANSWER:
[A more detailed, explanatory answer. Multiple paragraphs are fine;
keep paragraph spacing tight. Use a blank line only between distinct
sub-sections within the long answer.]
"""

############# END QUESTION GENERATOR PROMPTS ############


############# QUESTION GEN PROMPTS: ###########

# The user-supplied "quiz content" is appended to the END of
# template before being sent to the AI. The selected categories are
# also injected so the AI can tag generated questions appropriately.
QUESTION_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that creates short, basic study questions and
answers from supplied source material, for use in a spaced-repetition
quiz app.

Generate between {qty_from} and {qty_to} question/answer pairs total.

Each question should:
- Be short, clear, and self-contained. The person answering these
  questions will NOT have access to the source material, so every
  question must stand entirely on its own.
- NEVER reference the source material itself. Do not use phrases like
  "According to the text", "Based on the provided material", "In the
  article", "As shown in the document", or any similar wording.
- NEVER reference specific locations or identifiers from the source
  material. Do not use cross-references like "See equation (2.5)",
  "as described in Chapter 3", "refer to Figure 4", "in the example
  above", "per the preceding paragraph", or anything similar. If
  something from the source is needed in the question (e.g. a
  formula, a definition, a specific data point), copy that content
  directly into the question text instead of pointing the reader
  elsewhere.
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
material (but write them as self-contained questions that never mention
or reference the source material itself):

---
"""

# --- Common extend UI options -----------------------------------------
#
# These back the checkboxes in the shared React "Extend" component.
# `label` is shown to the user; `prompt` is appended to the AI prompt
# when the option is selected.

BASE_EXTEND_PROMPT = """\
You are extending an existing study question's answer into a more
detailed, explanatory version, for use in a spaced-repetition quiz
app. Stay focused on the question and the topic / category it sits
in - do NOT deviate into unrelated material.

The topic is {categories}.

Keep spacing TIGHT between paragraphs. Put a single blank line
between distinct sub-sections where applicable.
The user has requested an AI-assisted change to this study question.
Incorporate the selected options below while staying focused on the question and its topic.

Use the appropriate Markdown for each kind of content that make the answer more readable and
professional, but don't force it if it's not needed:
    LaTeX math (`$...$` / `$$...$$`) for formulas,
    fenced code blocks with language tags for code,
    `mermaid` fenced blocks for diagrams,
    Use _..._ for subscript and ^...^ for superscript when needed.
    Standard Markdown supported.

Question:
{question}

Current answer:
{current_answer}
{user_instructions_block}
"""


DEFAULT_EXTEND_PROMPT_TEMPLATE = """\
Write a more detailed, explanatory answer for the question above.
Stick to the question and the topic; do not wander outside that
category.

Format your output EXACTLY in the following layout. Keep spacing
TIGHT between paragraphs within a section. Use the literal
labels shown below:

SHORT ANSWER:
[A concise summary answer. One to two sentences.]

LONG ANSWER:
[A more detailed, explanatory answer. Multiple paragraphs are fine;
keep paragraph spacing tight. Use a blank line only between distinct
sub-sections within the long answer.]

Optionally, if a hint would meaningfully help a learner approach
this question, include one - otherwise leave the hint empty, however do not
give the answer away in the hint!
"""


EXTEND_OPTIONS: List[dict] = [
    {
        "key": "default",
        "label": "Use Long Answer, Short Answer format.",
        "prompt": DEFAULT_EXTEND_PROMPT_TEMPLATE,
    },
    {
        "key": "rephrase",
        "label": "rephrase this question.",
        "prompt": "Improve this question content so it is clear, well-structured, and easy to read and understand.",
    },
    {
        "key": "reformat",
        "label": "Re-format this question.",
        "prompt": "Re-format this answer content so it is clear, well-structured, and easy to read while preserving the original meaning.",
    },
    {
        "key": "focus_question",
        "label": "Focus on the 'question' text.",
        "prompt": "Focus your changes primarily on improving the question text. You may leave the answer mostly unchanged unless doing so makes the question unclear.",
    },
    {
        "key": "focus_answer",
        "label": "Focus on the 'answer' text.",
        "prompt": "Focus your changes primarily on improving and clarifying the answer text. Keep the question substantially the same unless it must be adjusted to match a better answer.",
    },
    {
        "key": "provide_hint",
        "label": "Provide a helpful hint.",
        "prompt": "Provide a short, useful hint that nudges the learner toward the answer without giving it away outright.",
    },
    {
        "key": "fact_check",
        "label": "Fact-check this question.",
        "prompt": "Carefully fact-check the question and answer. Correct any inaccuracies and note what changed if anything was wrong.",
    },
    {
        "key": "shorten",
        "label": "Shorten this up.",
        "prompt": "Shorten the answer to just the essential answer to the question!",
    },
    {
        "key": "improve",
        "label": "Improve this answer.",
        "prompt": "Improve the wording, phrasing, and overall clarity of the answer. Use active, concise language suitable for studying. Make sure it's informative, take liberty to re-word the answer, explain better, and/or give a more in depth and accurate answer.",
    },
    {
        "key": "redo_markup",
        "label": "Redo the markup and formatting.",
        "prompt": """The markup for this answer has serious shortcomings.
        Re-do the formatting so it is clean,
        well-organized, and Make the answer look polished and professional.
        Supported formatting:
        - LaTeX math with $...$ or $$...$$ for formulas
        - fenced code blocks with language tags for code
        - fenced `mermaid` blocks for diagrams
        - GFM pipe tables for tabular data
        - Use _..._ for subscript and ^...^ for superscript.
        - basic Markdown lists, bold, and italics
        But do not force advanced formatting. Keep the answer clean, readable, and appropriate for the content."""
    },
    {
        "key": "add_mermaid",
        "label": "Add a Mermaid diagram.",
        "prompt": "Add a Mermaid diagram (using a triple-backtick fenced block tagged `mermaid`) to help visualize or explain the answer content. Use an appropriate diagram type: flowchart, sequence, class, or graph. Make the diagram clear, well-labeled, and directly relevant to the question topic.",
    },
]


def build_extend_instructions(
    custom_instructions: str = "",
    selected_options: Optional[List[str]] = None,
) -> str:
    """Build the user-instructions block for the extend prompt.

    Uses the selected option prompts and any free-text instructions
    supplied by the user. When no options are selected, the "default"
    option (short-answer / long-answer format) is automatically included.
    Returns just the options block string - the caller is responsible for
    injecting it into BASE_EXTEND_PROMPT's {user_instructions_block}.
    """
    selected_options = selected_options or []

    # Always include the "default" option when nothing else is selected.
    if not selected_options:
        selected_options = ["default"]

    option_map = {opt["key"]: opt["prompt"] for opt in EXTEND_OPTIONS}

    parts = []

    option_prompts = [
        option_map[key] for key in selected_options if key in option_map
    ]
    if option_prompts:
        parts.append("Selected options:")
        parts.extend(f"- {p.strip()}" for p in option_prompts)

    custom = (custom_instructions or "").strip()
    if custom:
        parts.append(f"Additional user instructions for this extension:\n{custom}")

    if not parts:
        return ""

    return "\n\n" + "\n\n".join(parts) + "\n"


############## END QUESTION GEN PROMPTS ##########



###### END GENERATE TEXT FOR AUDIO ###########
GENERATE_TTS_AUDIO_TEXT = """
You are preparing text for a Text-to-Speech system.

Task:
Rewrite the quiz {part} below into the final text that should be spoken aloud.

Target language:
{language}

Language instructions:
{language_instruction}

Original {part}:
{source_text}

Rules:
1. Return only the final spoken text.
2. Do not return JSON.
3. Do not use Markdown.
4. Do not include labels like "Question:", "Answer:", "Hint:", "Short answer:", or "ANSWER:".
5. Preserve the meaning and facts.
6. Make the text natural and easy to understand when spoken aloud.
7. Expand abbreviations that may be pronounced incorrectly.
8. Remove formatting marks, section separators, and awkward symbols.
9. If the target language is not en_US, translate the text into the target language.
10. If the target language is Spanish, the output must be Spanish, not English.
11. If formulas are present then omit them unless you find it impossible to convey
the meaning of the overall concept without a very short formula, in that case
then explain it in plain words instead of reading symbols.
"11. If formulas are present then omit them unless you find it impossible to convey "
"the meaning of the overall concept without a very short formula, in that case "
"then explain it in plain words instead of reading symbols. "
"Ultimately, Avoid formulas whenever possible because they are hard to understand in spoken audio. "
"When you asbolutely must include a formula make sure you write them out so it can be comprehended when spoken. "
"So E=Mc2 would be energy is equal to the mass times the speed of light squared; x_i or x_..i.._ would become x sub i"
"""

###### END GENERATE TEXT FOR AUDIO ###########


IDENTICAL_QUESTION_CONSTRAINT = """\
Do NOT generate any questions that are identical or near
identical as the following existing questions:\n
"""
# Prompt constant for identical question constraint