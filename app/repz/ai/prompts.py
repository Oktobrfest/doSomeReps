# All AI prompts go here:
##### ASK AI PROMPTS: ######
SYSTEM_PROMPT = (
    "You are a tutor teaching a student.\n"
    "Guidelines:\n"
    "1. Answer the question clearly and concisely.\n"
    "2. If the transcript is unclear or too ambiguous to answer, ask one short "
    "clarifying question and stop.\n"
    "3. Keep explanations focused and digestible for spoken audio: short sentences, "
    "plain language, no Markdown, no tables, no code blocks or formulas.\n"
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
questions in a spaced-repetition app. You will be given a list of
questions (with their answers) that were generated previously.

For each question, decide whether the question is difficult enough
that a hint would actually help a learner who is stuck. ONLY produce
a hint when the question warrants one - if a question is easy,
straightforward, or its answer is obvious from the wording, return
no hint (null) for that item.

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

Optionally, if a hint would meaningfully help a learner approach
this question, include one - otherwise leave the hint empty.
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

HINT_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that writes optional study hints for quiz
questions in a spaced-repetition app. You will be given a list of
questions (with their answers) that were generated previously.

For each question, decide whether the question is difficult enough
that a hint would actually help a learner who is stuck. ONLY produce
a hint when the question warrants one - if a question is easy,
straightforward, or its answer is obvious from the wording, return
no hint (null) for that item.

When you do produce a hint:
- Keep it short (one sentence is ideal).
- Nudge the learner toward the answer without giving the answer
  away outright.
- Do not restate the answer or include the answer text verbatim.

Return one hint entry per input question, in the same order as the
input, so they can be matched up by position.

Questions to consider follow below (JSON):
---
"""

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

Optionally, if a hint would meaningfully help a learner approach
this question, include one - otherwise leave the hint empty.
"""

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
"So E=Mc2 would be energy is equal to the mass times the speed of light squared, and x_i would become x sub i\n"
"""

###### END GENERATE TEXT FOR AUDIO ###########
