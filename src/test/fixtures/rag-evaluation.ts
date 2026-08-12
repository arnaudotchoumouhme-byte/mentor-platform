export const RAG_EVALUATION_FIXTURES = Object.freeze([
  {
    question: "Quelle est la différence entre pharmacocinétique et pharmacodynamie ?",
    expectedSources: ["PK.txt", "PD.txt"], expectedChunks: ["pk", "pd"],
    shouldAnswer: true, shouldRefuse: false,
  },
  {
    question: "Que dit la bibliothèque sur le composé synthétique xyzzyplugh ?",
    expectedSources: [], expectedChunks: [], shouldAnswer: false, shouldRefuse: true,
  },
]);
