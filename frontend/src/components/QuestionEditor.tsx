import React, { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { CatPicker } from "./CatPicker";

interface PicData {
  pic_string: string;
  pic_id: number;
}

interface PicsByType {
  hint: PicData[];
  answer: PicData[];
  question: PicData[];
}

interface AudioData {
  audio_id: number;
  part: string;
  audio_text: string;
  public_url: string;
  language: string;
  object_key: string;
}

interface QuestionData {
  id: number;
  question_text: string;
  hint: string;
  answer: string;
  privacy: boolean;
  categories: string[];
  pics_by_type: PicsByType;
  audio_files?: AudioData[];
}

interface QuestionEditorProps {
  questionId: number | null;
  onDeleted?: () => void;
  onSaved?: () => void;
  onClose?: () => void;
}

export function QuestionEditor({
  questionId,
  onDeleted,
  onSaved,
  onClose,
}: QuestionEditorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState<string>("");
  const [hintText, setHintText] = useState<string>("");
  const [answerText, setAnswerText] = useState<string>("");
  const [privacy, setPrivacy] = useState<boolean>(false);
  const [pics, setPics] = useState<PicsByType>({ hint: [], answer: [], question: [] });
  const [audioFiles, setAudioFiles] = useState<AudioData[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Selected new files for upload
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [hintFiles, setHintFiles] = useState<File[]>([]);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Fetch question data when questionId changes
  useEffect(() => {
    if (!questionId) {
      setQuestionText("");
      setHintText("");
      setAnswerText("");
      setPrivacy(false);
      setPics({ hint: [], answer: [], question: [] });
      setAudioFiles([]);
      setSelectedCats([]);
      setQuestionFiles([]);
      setHintFiles([]);
      setAnswerFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch("/getq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionId),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load question details.");
        return res.json() as Promise<QuestionData>;
      })
      .then((qData) => {
        setQuestionText(qData.question_text || "");
        setHintText(qData.hint || "");
        setAnswerText(qData.answer || "");
        setPrivacy(!!qData.privacy);
        setPics(qData.pics_by_type || { hint: [], answer: [], question: [] });
        setAudioFiles(qData.audio_files || []);
        setSelectedCats(qData.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "An error occurred.");
        setLoading(false);
      });
  }, [questionId]);

  const validateFiles = (files: File[]): boolean => {
    const invalidCharRegex = /[^a-zA-Z0-9_. !@#$%^&()\-]/;
    const invalidFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const filename = files[i].name;
      const startsWithDot = filename.startsWith(".");
      const hasExtension = filename.includes(".");

      if (startsWithDot && !hasExtension) {
        invalidFiles.push(filename);
      } else if (invalidCharRegex.test(filename)) {
        invalidFiles.push(filename);
      }
    }

    if (invalidFiles.length > 0) {
      toast.error("The following filenames are invalid: " + invalidFiles.join(", "));
      return false;
    }
    return true;
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (validateFiles(filesArray)) {
        setFiles(filesArray);
      } else {
        e.target.value = "";
        setFiles([]);
      }
    }
  };

  const removeExistingPic = (type: keyof PicsByType, id: number) => {
    setPics((prev) => ({
      ...prev,
      [type]: prev[type].filter((pic) => pic.pic_id !== id),
    }));
  };

  const handleAudioDelete = async (audioId: number) => {
    try {
      const res = await fetch("/delete_audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio_id: audioId }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete audio asset.");
      }
      setAudioFiles((prev) => prev.filter((aud) => aud.audio_id !== audioId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete audio.");
    }
  };

  const removeNewFile = (
    index: number,
    files: File[],
    setFiles: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleDelete = async () => {
    if (!questionId) return;

    const confirmed = window.confirm("Are you sure you want to delete this question?");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/deleteq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete the question.");
      }

      setSuccessMsg("Question deleted successfully!");
      // Clear the form
      setQuestionText("");
      setHintText("");
      setAnswerText("");
      setPrivacy(false);
      setPics({ hint: [], answer: [], question: [] });
      setAudioFiles([]);
      
      if (onDeleted) {
        setTimeout(() => {
          onDeleted();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete question.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionId) return;

    if (selectedCats.length === 0) {
      toast.error("Please select at least one category before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      id: questionId,
      question_text: questionText,
      hint: hintText,
      answer: answerText,
      privacy,
      categories: selectedCats,
      pics_by_type: {
        hint: pics.hint.map((p) => p.pic_string),
        answer: pics.answer.map((p) => p.pic_string),
        question: pics.question.map((p) => p.pic_string),
      },
    };

    const formData = new FormData();
    formData.append("updated_question", JSON.stringify(payload));

    // Append new files
    questionFiles.forEach((file) => {
      formData.append("question_image", file);
    });
    hintFiles.forEach((file) => {
      formData.append("hint_image", file);
    });
    answerFiles.forEach((file) => {
      formData.append("answer_pics", file);
    });

    try {
      const res = await fetch("/saveq", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to save the question.");
      }

      toast.success("Question saved successfully!");
      // Clear newly uploaded files states after successful save
      setQuestionFiles([]);
      setHintFiles([]);
      setAnswerFiles([]);
      
      // Reload details from API to get the correct current state with new pictures S3 URLs
      fetch("/getq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionId),
      })
        .then((res) => res.json() as Promise<QuestionData>)
        .then((qData) => {
          setPics(qData.pics_by_type || { hint: [], answer: [], question: [] });
          setAudioFiles(qData.audio_files || []);
        })
        .catch(console.error);
      
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading question data...</p>
      </div>
    );
  }

  if (!questionId && !loading) {
    return (
      <p className="text-muted mt-5 pt-5 text-center">Select a question from the search results to edit it.</p>
    );
  }

  return (
    <div className="container py-4">
      <Toaster richColors position="top-right" />
      <div className="card shadow-sm border-0">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <h4 className="mb-0">
              <i className="fa fa-edit mr-2"></i>Edit Question
            </h4>
            {onClose && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>

        <div className="card-body bg-light">
          {successMsg && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <strong>Success!</strong> {successMsg}
              <button
                type="button"
                className="close"
                onClick={() => setSuccessMsg(null)}
              >
                <span>&times;</span>
              </button>
            </div>
          )}

          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <strong>Error!</strong> {error}
              <button type="button" className="close" onClick={() => setError(null)}>
                <span>&times;</span>
              </button>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="row">
              {/* Form Input fields */}
              <div className="col-md-12">
                <div className="form-group mb-4">
                  <label htmlFor="react-q-text" className="font-weight-bold text-dark">
                    Question Text
                  </label>
                  <textarea
                    id="react-q-text"
                    className="form-control"
                    rows={4}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    required
                  />

                  {/* Question Images Section */}
                  <div className="mt-3">
                    {pics.question.length > 0 && (
                      <div className="mb-2">
                        <span className="small font-weight-bold text-secondary">Existing Question Images:</span>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {pics.question.map((p) => (
                            <div key={p.pic_id} className="position-relative m-1" style={{ width: "80px", height: "80px" }}>
                              <img src={p.pic_string} alt="question" className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                              <button
                                type="button"
                                className="btn btn-danger btn-sm position-absolute"
                                style={{ top: "-5px", right: "-5px", padding: "1px 6px", borderRadius: "50%" }}
                                onClick={() => removeExistingPic("question", p.pic_id)}
                                title="Delete Image"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="custom-file mt-2">
                      <input
                        type="file"
                        className="custom-file-input"
                        id="react-q-file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setQuestionFiles)}
                      />
                      <label className="custom-file-label" htmlFor="react-q-file">
                        {questionFiles.length > 0 ? `${questionFiles.length} file(s) selected` : "Add Question Images"}
                      </label>
                    </div>

                    {/* New Question Files Previews */}
                    {questionFiles.length > 0 && (
                      <div className="d-flex flex-wrap mt-2">
                        {questionFiles.map((file, idx) => (
                          <div key={idx} className="position-relative m-1" style={{ width: "60px", height: "60px" }}>
                            <img src={URL.createObjectURL(file)} className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                            <button
                              type="button"
                              className="btn btn-warning btn-sm position-absolute"
                              style={{ top: "-5px", right: "-5px", padding: "1px 5px", borderRadius: "50%", fontSize: "10px" }}
                              onClick={() => removeNewFile(idx, questionFiles, setQuestionFiles)}
                              title="Remove selected file"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group mb-4">
                  <label htmlFor="react-hint-text" className="font-weight-bold text-dark">
                    Hint
                  </label>
                  <textarea
                    id="react-hint-text"
                    className="form-control"
                    rows={2}
                    value={hintText}
                    onChange={(e) => setHintText(e.target.value)}
                  />

                  {/* Hint Images Section */}
                  <div className="mt-3">
                    {pics.hint.length > 0 && (
                      <div className="mb-2">
                        <span className="small font-weight-bold text-secondary">Existing Hint Images:</span>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {pics.hint.map((p) => (
                            <div key={p.pic_id} className="position-relative m-1" style={{ width: "80px", height: "80px" }}>
                              <img src={p.pic_string} alt="hint" className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                              <button
                                type="button"
                                className="btn btn-danger btn-sm position-absolute"
                                style={{ top: "-5px", right: "-5px", padding: "1px 6px", borderRadius: "50%" }}
                                onClick={() => removeExistingPic("hint", p.pic_id)}
                                title="Delete Image"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="custom-file mt-2">
                      <input
                        type="file"
                        className="custom-file-input"
                        id="react-hint-file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setHintFiles)}
                      />
                      <label className="custom-file-label" htmlFor="react-hint-file">
                        {hintFiles.length > 0 ? `${hintFiles.length} file(s) selected` : "Add Hint Images"}
                      </label>
                    </div>

                    {/* New Hint Files Previews */}
                    {hintFiles.length > 0 && (
                      <div className="d-flex flex-wrap mt-2">
                        {hintFiles.map((file, idx) => (
                          <div key={idx} className="position-relative m-1" style={{ width: "60px", height: "60px" }}>
                            <img src={URL.createObjectURL(file)} className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                            <button
                              type="button"
                              className="btn btn-warning btn-sm position-absolute"
                              style={{ top: "-5px", right: "-5px", padding: "1px 5px", borderRadius: "50%", fontSize: "10px" }}
                              onClick={() => removeNewFile(idx, hintFiles, setHintFiles)}
                              title="Remove selected file"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group mb-4">
                  <label htmlFor="react-answer-text" className="font-weight-bold text-dark">
                    The Answer
                  </label>
                  <textarea
                    id="react-answer-text"
                    className="form-control"
                    rows={4}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    required
                  />

                  {/* Answer Images Section */}
                  <div className="mt-3">
                    {pics.answer.length > 0 && (
                      <div className="mb-2">
                        <span className="small font-weight-bold text-secondary">Existing Answer Images:</span>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {pics.answer.map((p) => (
                            <div key={p.pic_id} className="position-relative m-1" style={{ width: "80px", height: "80px" }}>
                              <img src={p.pic_string} alt="answer" className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                              <button
                                type="button"
                                className="btn btn-danger btn-sm position-absolute"
                                style={{ top: "-5px", right: "-5px", padding: "1px 6px", borderRadius: "50%" }}
                                onClick={() => removeExistingPic("answer", p.pic_id)}
                                title="Delete Image"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="custom-file mt-2">
                      <input
                        type="file"
                        className="custom-file-input"
                        id="react-answer-file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setAnswerFiles)}
                      />
                      <label className="custom-file-label" htmlFor="react-answer-file">
                        {answerFiles.length > 0 ? `${answerFiles.length} file(s) selected` : "Add Answer Images"}
                      </label>
                    </div>

                    {/* New Answer Files Previews */}
                    {answerFiles.length > 0 && (
                      <div className="d-flex flex-wrap mt-2">
                        {answerFiles.map((file, idx) => (
                          <div key={idx} className="position-relative m-1" style={{ width: "60px", height: "60px" }}>
                            <img src={URL.createObjectURL(file)} className="img-thumbnail w-100 h-100" style={{ objectFit: "cover" }} />
                            <button
                              type="button"
                              className="btn btn-warning btn-sm position-absolute"
                              style={{ top: "-5px", right: "-5px", padding: "1px 5px", borderRadius: "50%", fontSize: "10px" }}
                              onClick={() => removeNewFile(idx, answerFiles, setAnswerFiles)}
                              title="Remove selected file"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Audio Assets Section */}
                <div className="card border-info mb-4">
                  <div className="card-header bg-info text-white font-weight-bold py-2 d-flex align-items-center">
                    <i className="fa fa-volume-up mr-2"></i>Audio Assets
                  </div>
                  <div className="card-body">
                    {audioFiles.length === 0 ? (
                      <p className="text-muted mb-0">No audio assets generated for this question yet.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered table-striped mb-0">
                          <thead>
                            <tr>
                              <th>Part</th>
                              <th>Language</th>
                              <th>Text Snippet</th>
                              <th>Audio</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {audioFiles.map((aud) => (
                              <tr key={aud.audio_id}>
                                <td className="align-middle text-capitalize">
                                  <span className="badge badge-secondary">{aud.part}</span>
                                </td>
                                <td className="align-middle text-uppercase">
                                  <code>{aud.language}</code>
                                </td>
                                <td className="align-middle small text-truncate" style={{ maxWidth: "200px" }}>
                                  {aud.audio_text || "N/A"}
                                </td>
                                <td className="align-middle text-center">
                                  {aud.public_url ? (
                                    <audio src={aud.public_url} controls style={{ height: "30px", width: "180px" }} />
                                  ) : (
                                    <span className="text-muted">No URL</span>
                                  )}
                                </td>
                                <td className="align-middle text-center">
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleAudioDelete(aud.audio_id)}
                                    title="Delete Audio"
                                  >
                                    <i className="fa fa-trash"></i> Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* CatPicker Component */}
                <CatPicker
                  selectedCategories={selectedCats}
                  onChange={setSelectedCats}
                />

                <div className="form-group form-check mt-4">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="react-privacy"
                    checked={privacy}
                    onChange={(e) => setPrivacy(e.target.checked)}
                  />
                  <label className="form-check-label font-weight-bold" htmlFor="react-privacy">
                    Make Question Private
                  </label>
                </div>
              </div>
            </div>

            <div className="border-top pt-3 mt-3 d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting || !questionId}
              >
                {deleting ? "Deleting..." : "Delete Question"}
              </button>
              <button
                type="submit"
                className="btn btn-primary px-5"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}