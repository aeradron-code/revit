import { create } from "zustand";

type Pending = { token: number; revision: number };
type Draft = {
  body: string;
  bodyRevision: number;
  replyBody: string;
  replyTargetId: string | null;
  replyRevision: number;
  commentPending: Pending | null;
  replyPending: Pending | null;
  commentError: string | null;
  replyError: string | null;
};

const emptyDraft: Draft = {
  body: "",
  bodyRevision: 0,
  replyBody: "",
  replyTargetId: null,
  replyRevision: 0,
  commentPending: null,
  replyPending: null,
  commentError: null,
  replyError: null,
};
let nextToken = 0;

type DraftState = {
  drafts: Record<string, Draft>;
  update: (key: string, change: (draft: Draft) => Draft) => void;
  begin: (key: string, kind: "comment" | "reply") => number | null;
  finish: (
    key: string,
    kind: "comment" | "reply",
    token: number,
    success: boolean,
    message?: string,
  ) => void;
  clearAll: () => void;
};

export const useInlineDrafts = create<DraftState>((set, get) => ({
  drafts: {},
  update: (key, change) =>
    set((state) => {
      const draft = change(state.drafts[key] ?? emptyDraft);
      if (
        !draft.body &&
        !draft.replyBody &&
        !draft.replyTargetId &&
        !draft.commentPending &&
        !draft.replyPending
      ) {
        const { [key]: _removed, ...remaining } = state.drafts;
        return { drafts: remaining };
      }
      return { drafts: { ...state.drafts, [key]: draft } };
    }),
  begin: (key, kind) => {
    const draft = get().drafts[key];
    if (
      !draft ||
      (kind === "comment" ? draft.commentPending : draft.replyPending)
    )
      return null;
    const token = ++nextToken;
    get().update(key, (current) =>
      kind === "comment"
        ? {
            ...current,
            commentPending: { token, revision: current.bodyRevision },
            commentError: null,
          }
        : {
            ...current,
            replyPending: { token, revision: current.replyRevision },
            replyError: null,
          },
    );
    return token;
  },
  finish: (key, kind, token, success, message) => {
    const draft = get().drafts[key];
    const pending =
      kind === "comment" ? draft?.commentPending : draft?.replyPending;
    if (!draft || !pending || pending.token !== token) return;
    get().update(key, (current) =>
      kind === "comment"
        ? {
            ...current,
            commentPending: null,
            commentError: success ? null : (message ?? null),
            body:
              success && current.bodyRevision === pending.revision
                ? ""
                : current.body,
          }
        : {
            ...current,
            replyPending: null,
            replyError: success ? null : (message ?? null),
            replyBody:
              success && current.replyRevision === pending.revision
                ? ""
                : current.replyBody,
            replyTargetId:
              success && current.replyRevision === pending.revision
                ? null
                : current.replyTargetId,
          },
    );
  },
  clearAll: () => set({ drafts: {} }),
}));
