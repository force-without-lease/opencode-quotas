export const QuotaRpc = {
  id: "claudesub-quotas",
  methods: {
    token: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: { token: { type: "string" } },
        additionalProperties: false,
      },
    },
    chatgpt: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: { token: { type: "string" }, accountID: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  events: {},
};
