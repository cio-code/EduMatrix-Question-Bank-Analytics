/** Shared in-memory data, the selected course, and small loaders used by several steps. */
window.Steps = window.Steps || {};
window.State = { session: null, courses: [], courseId: "", tos: null, questions: [], exams: [] };

(function () {
  const KEY = "edumatrix.course";

  window.Data = {
    /** Loads the course list and keeps the selected course valid (remembered for this browser tab). */
    async courses() {
      State.courses = await API.call("listCourses");
      if (!State.courses.some((c) => c.courseId === State.courseId)) {
        const saved = sessionStorage.getItem(KEY);
        State.courseId = State.courses.some((c) => c.courseId === saved) ? saved : (State.courses[0] ? State.courses[0].courseId : "");
      }
      return State.courses;
    },
    setCourse(id) {
      State.courseId = id || "";
      sessionStorage.setItem(KEY, State.courseId);
      State.tos = null;
    },
    /** The TOS (and course details) of the selected course. */
    async tos(force) {
      if (!State.courseId) { State.tos = null; return null; }
      if (force || !State.tos || State.tos.course.courseId !== State.courseId) {
        State.tos = await API.call("getTos", { courseId: State.courseId });
      }
      return State.tos;
    },
    async questions() {
      State.questions = State.courseId ? await API.call("listQuestions", { courseId: State.courseId }) : [];
      return State.questions;
    },
    async exams() {
      State.exams = State.courseId ? await API.call("listExams", { courseId: State.courseId }) : [];
      return State.exams;
    },

    /** The "Course & title" bar shown at the top of steps 2 to 5. */
    courseBarHtml(selectId, extraHtml) {
      return '<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4 no-print">' +
        '<div class="flex-1" style="min-width:16rem"><label for="' + selectId + '" class="lbl">Course &amp; title</label>' +
        '<select id="' + selectId + '" class="inp" style="font-size:.875rem;padding:.5rem"></select></div>' + (extraHtml || "") + "</div>";
    },
    fillCourseSelect(sel) {
      // a TOS older than the limit is marked with a warning sign and red text
      sel.innerHTML = State.courses.length
        ? State.courses.map((c) => {
            const old = c.status === "Expired";
            return '<option value="' + UI.esc(c.courseId) + '"' + (old ? ' style="color:#b91c1c"' : "") + ">" + (old ? "\u26A0 " : "") + UI.esc(c.course) + (old ? " (TOS over " + (c.maxYears || 3) + " years)" : "") + "</option>";
          }).join("")
        : '<option value="">No course yet</option>';
      sel.value = State.courseId;
    }
  };
})();