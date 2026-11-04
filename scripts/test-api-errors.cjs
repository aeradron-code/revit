const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { QueryClient } = require("@tanstack/react-query");

function loadTypeScript(path, dependencies = {}) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const run = vm.runInThisContext(
    `(function(require, module, exports) { ${compiled}\n})`,
  );
  run(
    (name) =>
      dependencies[name] ??
      (name === "./creation-recovery"
        ? loadTypeScript("src/api/creation-recovery.ts", dependencies)
        : name === "./supabase-errors"
          ? loadTypeScript("src/api/supabase-errors.ts", {
              ...dependencies,
              "./errors": dependencies["./errors"] ?? errors,
            })
          : name.startsWith("@/")
            ? loadTypeScript(`src/${name.slice(2)}.ts`, dependencies)
            : require(name)),
    module,
    module.exports,
  );
  return module.exports;
}

const errors = loadTypeScript("src/api/errors.ts");
const { runApiRequest } = loadTypeScript("src/api/request.ts", {
  "./errors": errors,
});

test("image identity deduplicates repeated web files by content", async () => {
  const { getImageIdentity } = loadTypeScript(
    "src/components/media/image-identity.ts",
  );
  const makeFile = (bytes, name) => {
    const file = new Blob([Uint8Array.from(bytes)], { type: "image/png" });
    Object.defineProperties(file, {
      name: { value: name },
      lastModified: { value: 1 },
    });
    return file;
  };
  const first = await getImageIdentity({
    assetId: null,
    uri: "blob:first-selection",
    file: makeFile([1, 2, 3], "same.png"),
  });
  const repeated = await getImageIdentity({
    assetId: null,
    uri: "blob:second-selection",
    file: makeFile([1, 2, 3], "same.png"),
  });
  const different = await getImageIdentity({
    assetId: null,
    uri: "blob:different-image",
    file: makeFile([1, 2, 4], "same.png"),
  });
  assert.equal(first, repeated);
  assert.notEqual(first, different);
});

test("normalizes backend errors without exposing their messages", () => {
  const cause = { code: "23505", message: "private database detail" };
  const error = errors.normalizeApiError(cause, "Could not save.", 403);
  assert.equal(error.message, "Could not save.");
  assert.equal(error.code, errors.API_ERROR_CODES.FORBIDDEN);
  assert.equal(error.status, 403);
  assert.equal(error.cause, cause);
});

test("image preparation reports safe validation and file-read failures", async () => {
  const privateFailure = new Error("private file path");
  const images = loadTypeScript("src/lib/media/read-local-image.ts", {
    "@/api/errors": errors,
    "expo-file-system": {
      File: class {
        async arrayBuffer() {
          throw privateFailure;
        }
      },
    },
  });
  await assert.rejects(
    images.readLocalImage({ uri: "file:///unsupported.gif" }),
    (error) =>
      error.code === errors.API_ERROR_CODES.VALIDATION_ERROR &&
      error.message === errors.API_ERROR_MESSAGES.INVALID_IMAGE_TYPE,
  );
  for (const image of [
    { uri: "file:///photo.jpg" },
    {
      uri: "blob:photo",
      mimeType: "image/jpeg",
      file: {
        arrayBuffer: async () => {
          throw privateFailure;
        },
      },
    },
  ]) {
    await assert.rejects(images.readLocalImage(image), (error) => {
      assert.equal(error.message, errors.API_ERROR_MESSAGES.READ_IMAGE);
      assert.equal(error.cause, privateFailure);
      return true;
    });
  }
  const bytes = new ArrayBuffer(3);
  const result = await images.readLocalImage({
    uri: "blob:photo",
    mimeType: "image/jpeg",
    file: { arrayBuffer: async () => bytes },
  });
  assert.equal(result.data, bytes);
  assert.equal(result.contentType, "image/jpeg");
});

test("Ask retry reuses prepared images and failed reads can be retried", async () => {
  let reads = 0;
  let fail = true;
  const media = loadTypeScript("src/lib/media/read-local-image.ts", {
    "@/api/errors": errors,
    "expo-file-system": { File: class {} },
  });
  const attempt = { id: "attempt" };
  const images = [
    {
      uri: "photo.jpg",
      file: {
        async arrayBuffer() {
          reads++;
          if (fail) throw new Error("unavailable");
          return new ArrayBuffer(1);
        },
      },
    },
  ];
  await assert.rejects(media.prepareAskAttemptImages(attempt, images));
  fail = false;
  const first = await media.prepareAskAttemptImages(attempt, images);
  fail = true;
  assert.equal(await media.prepareAskAttemptImages(attempt, images), first);
  assert.equal(reads, 2);
});

test("Ask recovery storage isolates accounts and preserves storage failures", async () => {
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  const { createAskRecoveryStore } = loadTypeScript(
    "src/services/creation/ask-recovery-store.ts",
    {
      "expo-secure-store": {},
      "react-native": { Platform: { OS: "web" } },
    },
  );
  const store = createAskRecoveryStore(storage);
  const first = "00000000-0000-4000-8000-000000000001";
  const second = "00000000-0000-4000-8000-000000000002";
  const operation = "00000000-0000-4000-8000-000000000003";
  await store.save(first, operation);
  await assert.rejects(
    store.save(first, "00000000-0000-4000-8000-000000000004"),
  );
  assert.equal(await store.load(first), operation);
  assert.equal(await store.load(second), null);
  assert.equal(
    await store.clearIfMatches(first, "00000000-0000-4000-8000-000000000004"),
    false,
  );
  assert.equal(await store.load(first), operation);
  assert.equal(await store.clearIfMatches(first, operation), true);
  assert.equal(await store.load(first), null);
  assert.equal(await store.clearIfMatches(first, operation), true);
  const newer = "00000000-0000-4000-8000-000000000004";
  await store.save(first, operation);
  await Promise.all([
    store.clearIfMatches(first, operation),
    store.save(first, newer),
  ]);
  assert.equal(await store.clearIfMatches(first, operation), false);
  assert.equal(await store.load(first), newer);
  await assert.rejects(store.save(first, "invalid"));
  const broken = createAskRecoveryStore({
    ...storage,
    setItem: async () => {
      throw new Error("storage unavailable");
    },
  });
  await assert.rejects(broken.save(first, newer), /storage unavailable/);
});

test("a shared recovery lock prevents two store instances claiming one account", async () => {
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  let pending = Promise.resolve();
  const coordinate = (action) => {
    const result = pending.then(action);
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const { createAskRecoveryStore } = loadTypeScript(
    "src/services/creation/ask-recovery-store.ts",
    {
      "expo-secure-store": {},
      "react-native": { Platform: { OS: "native" } },
    },
  );
  const first = createAskRecoveryStore(storage, coordinate);
  const second = createAskRecoveryStore(storage, coordinate);
  const user = "00000000-0000-4000-8000-000000000001";
  const a = "00000000-0000-4000-8000-000000000002";
  const b = "00000000-0000-4000-8000-000000000003";
  const results = await Promise.allSettled([
    first.save(user, a),
    second.save(user, b),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.ok([a, b].includes(await first.load(user)));
});

test("Ask submission persists identity before writing and retains uncertain outcomes", async () => {
  const { submitAskWithRecovery } = loadTypeScript(
    "src/services/creation/submit-ask-with-recovery.ts",
    {
      "@/lib/media/read-local-image": {
        prepareAskAttemptImages: async () => [],
      },
      "./ask-recovery-store": {
        askRecoveryStore: {},
        postRecoveryStores: {},
      },
    },
  );
  const events = [];
  const input = {
    authorId: "user",
    body: "Question?",
    images: [],
    attempt: { id: "operation" },
  };
  const deps = {
    prepare: async () => [],
    save: async () => {
      events.push("save");
    },
    clear: async () => {
      events.push("clear");
    },
    create: async ({ attempt }) => {
      events.push("create");
      attempt.outcomeUncertain = true;
      throw new Error("offline");
    },
  };
  await assert.rejects(submitAskWithRecovery(input, deps));
  assert.deepEqual(events, ["save", "create"]);
  events.length = 0;
  deps.save = async () => {
    throw new Error("storage unavailable");
  };
  await assert.rejects(submitAskWithRecovery(input, deps));
  assert.deepEqual(events, []);
  deps.save = async () => {
    events.push("save");
  };
  deps.create = async () => {
    events.push("create");
    return { id: "post" };
  };
  deps.clear = async () => {
    events.push("clear");
    throw new Error("storage unavailable");
  };
  assert.equal((await submitAskWithRecovery(input, deps)).id, "post");
  assert.deepEqual(events, ["save", "create", "clear"]);
});

test("comment count does not report zero when the server omits the count", async () => {
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    abortSignal() {
      return Promise.resolve({ count: null, error: null, status: 200 });
    },
  };
  const comments = loadTypeScript("src/api/comments.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await assert.rejects(comments.getCommentCount("post"), (error) => {
    assert.equal(
      error.message,
      errors.API_ERROR_MESSAGES.LOAD_THE_COMMENT_COUNT,
    );
    return true;
  });
});

test("comment deletion requires a returned row and uses a safe error otherwise", async () => {
  let deleted = { id: "comment" };
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: deleted, error: null, status: 200 });
    },
  };
  const comments = loadTypeScript("src/api/comments.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await comments.deleteComment("comment");
  deleted = null;
  await assert.rejects(
    comments.deleteComment("comment"),
    (error) => error.message === errors.API_ERROR_MESSAGES.DELETE_YOUR_COMMENT,
  );
});

test("profile follow counts reject a missing count and preserve valid zeros", async () => {
  let counts = [0, 0];
  let call = 0;
  const profiles = loadTypeScript("src/api/profiles.ts", {
    "@/lib/supabase/client": {
      supabase: {
        from() {
          const count = counts[call++];
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            abortSignal() {
              return Promise.resolve({ count, error: null, status: 200 });
            },
          };
        },
      },
    },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  assert.deepEqual(await profiles.getFollowCounts("profile"), {
    followers: 0,
    following: 0,
  });
  for (const [values, expected] of [
    [[null, 0], errors.API_ERROR_MESSAGES.LOAD_FOLLOWER_TOTALS],
    [[0, null], errors.API_ERROR_MESSAGES.LOAD_FOLLOWING_TOTALS],
  ]) {
    counts = values;
    call = 0;
    await assert.rejects(
      profiles.getFollowCounts("profile"),
      (error) => error.message === expected,
    );
  }
});

test("a failed profile refetch retains the previously cached profile", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const queryKey = ["profiles", "id", "user"];
  const profile = {
    id: "user",
    onboarding_completed_at: "2026-10-30T00:00:00Z",
  };
  await client.fetchQuery({ queryKey, queryFn: async () => profile });
  await assert.rejects(
    client.fetchQuery({
      queryKey,
      queryFn: async () => {
        throw new Error("offline");
      },
    }),
  );
  assert.deepEqual(client.getQueryData(queryKey), profile);
  assert.equal(client.getQueryState(queryKey).status, "error");
  client.clear();
});

test("auth failures map known codes without exposing provider messages", () => {
  const error = errors.normalizeAuthError(
    {
      code: "invalid_credentials",
      message: "private provider detail",
      status: 400,
    },
    errors.API_ERROR_MESSAGES.SIGN_IN,
  );
  assert.equal(error.code, errors.API_ERROR_CODES.INVALID_CREDENTIALS);
  assert.equal(error.message, errors.API_ERROR_MESSAGES.INVALID_CREDENTIALS);
  assert.equal(error.status, 400);
});

test("retries a transient read and preserves status when retries are exhausted", async () => {
  let attempts = 0;
  const request = () => {
    attempts++;
    throw errors.normalizeApiError(
      { message: "private" },
      "Could not load.",
      503,
    );
  };
  await assert.rejects(runApiRequest(request, { retries: 1 }), (error) => {
    assert.equal(error.code, errors.API_ERROR_CODES.SERVER_ERROR);
    assert.equal(error.status, 503);
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(attempts, 2);
});

test("does not retry a write after a transient failure", async () => {
  let attempts = 0;
  await assert.rejects(
    runApiRequest(() => {
      attempts++;
      throw errors.normalizeApiError({}, "Could not save.", 503);
    }),
    (error) =>
      error.code === errors.API_ERROR_CODES.SERVER_ERROR && !error.retryable,
  );
  assert.equal(attempts, 1);
});

test("distinguishes cancellation from timeout", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runApiRequest(
      () => {
        throw new Error("must not run");
      },
      {
        signal: controller.signal,
        retries: 1,
      },
    ),
    (error) =>
      error.code === errors.API_ERROR_CODES.CANCELLED && !error.retryable,
  );

  await assert.rejects(
    runApiRequest(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
      { timeoutMs: 1 },
    ),
    (error) =>
      error.code === errors.API_ERROR_CODES.TIMEOUT && !error.retryable,
  );
});

test("cancelling during retry backoff rejects promptly without another attempt", async () => {
  const controller = new AbortController();
  let attempts = 0;
  const result = runApiRequest(
    () => {
      attempts++;
      throw errors.normalizeApiError({}, "Could not load.", 503);
    },
    { retries: 1, signal: controller.signal },
  ).then(
    () => "unexpected success",
    (error) => error.code,
  );
  controller.abort();
  const first = await Promise.race([
    result,
    new Promise((resolve) => setImmediate(() => resolve("still waiting"))),
  ]);
  assert.equal(first, errors.API_ERROR_CODES.CANCELLED);
  assert.equal(attempts, 1);
});

test("an attempt timeout does not continue running during retry backoff", async () => {
  let firstSignal;
  let attempts = 0;
  const value = await runApiRequest(
    (signal) => {
      attempts++;
      if (attempts === 1) {
        firstSignal = signal;
        throw errors.normalizeApiError({}, "Could not load.", 503);
      }
      return Promise.resolve("loaded");
    },
    { retries: 1, timeoutMs: 20 },
  );
  assert.equal(value, "loaded");
  assert.equal(attempts, 2);
  assert.equal(firstSignal.aborted, false);
});

test("handles transport failures and unknown exceptions", async () => {
  assert.equal(
    errors.normalizeApiError({}, "Could not load.", 0).code,
    errors.API_ERROR_CODES.NETWORK_ERROR,
  );
  await assert.rejects(
    runApiRequest(
      () => {
        throw new Error("private detail");
      },
      { message: "Could not load." },
    ),
    (error) =>
      error.code === errors.API_ERROR_CODES.UNKNOWN_ERROR &&
      error.message === "Could not load.",
  );
});

test("saving an Ask rating uses one atomic RPC and validates before calling it", async () => {
  const calls = [];
  const builder = {
    abortSignal() {
      return this;
    },
    async single() {
      return {
        data: { post_id: "post", rater_id: "user", score: 4 },
        error: null,
        status: 200,
      };
    },
  };
  const ratings = loadTypeScript("src/api/ratings.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        rpc(name, args) {
          calls.push({ name, args });
          return builder;
        },
      },
    },
  });
  await assert.rejects(
    ratings.saveAskRating("post", "user", 6),
    (error) => error.code === errors.API_ERROR_CODES.VALIDATION_ERROR,
  );
  assert.equal(calls.length, 0);
  const rating = await ratings.saveAskRating("post", "user", 4);
  assert.equal(rating.score, 4);
  assert.deepEqual(calls, [
    {
      name: "save_ask_rating",
      args: { p_post_id: "post", p_rater_id: "user", p_score: 4 },
    },
  ]);
});

test("forum posts use idempotent creation with a forum destination", async () => {
  const calls = [];
  const client = {
    rpc(name, args) {
      calls.push({ name, args });
      return {
        abortSignal() {
          return this;
        },
        async single() {
          return {
            data: { id: args.p_post_id, forum_id: args.p_forum_id },
            error: null,
            status: 200,
          };
        },
      };
    },
  };
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": { supabase: client },
    "expo-crypto": { randomUUID: () => "post-id" },
  });
  const share = {
    authorId: "user",
    forumId: "forum",
    entityId: "entity",
    score: 4,
    images: [],
  };
  const image = {
    contentType: "image/jpeg",
    extension: "jpg",
    data: new ArrayBuffer(1),
  };
  for (const invalid of [
    { ...share, score: 0 },
    { ...share, score: 2.5 },
    { ...share, images: [image, image, image, image] },
    { ...share, images: [{ ...image, data: new ArrayBuffer(0) }] },
  ]) {
    await assert.rejects(
      posts.createForumSharePost(invalid),
      (error) => error.code === errors.API_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  assert.equal(calls.length, 0);
  await posts.createForumAskPost({
    authorId: "user",
    attempt: { id: "ask-operation" },
    forumId: "forum",
    body: "Question?",
    images: [],
  });
  await posts.createForumSharePost({
    authorId: "user",
    attempt: { id: "share-operation" },
    forumId: "forum",
    entityId: "entity",
    score: 4,
    images: [],
  });
  assert.equal(calls[0].name, "create_post_idempotent");
  assert.equal(calls[1].name, "create_post_idempotent");
  assert.equal(calls[0].args.p_kind, "FORUM_ASK");
  assert.equal(calls[1].args.p_kind, "FORUM_SHARE");
  assert.equal(calls[0].args.p_operation_id, "ask-operation");
  assert.equal(calls[1].args.p_operation_id, "share-operation");
  assert.equal(calls[0].args.p_forum_id, "forum");
  assert.equal(calls[1].args.p_forum_id, "forum");
});

test("global Share creation passes its retained attempt to the idempotent API", async () => {
  let received;
  const shares = loadTypeScript("src/api/shares.ts", {
    "@/api/posts": {
      createIdempotentPost: async (input) => {
        received = input;
        return { id: input.attempt.id };
      },
    },
    "@/lib/supabase/client": { supabase: {} },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  const attempt = { id: "share-operation" };
  const input = {
    authorId: "user",
    attempt,
    entityId: "entity",
    score: 4,
    images: [],
  };
  assert.equal((await shares.createShareRating(input)).id, "share-operation");
  assert.equal(received.attempt, attempt);
  assert.equal(received.kind, "GLOBAL_SHARE");
  assert.equal(received.entityId, "entity");
  await assert.rejects(shares.createShareRating({ ...input, score: 0 }));
});

test("forum and find retries reuse the operation and uploaded image", async () => {
  for (const kind of ["FORUM", "FIND"]) {
    const calls = [];
    let uploads = 0;
    const client = {
      storage: {
        from: () => ({
          upload: async () => {
            uploads++;
            return { error: null };
          },
          getPublicUrl: (path) => ({
            data: {
              publicUrl: `https://example.invalid/storage/v1/object/public/entity-images/${path}`,
            },
          }),
        }),
      },
      from: () => ({
        select() {
          return this;
        },
        order() {
          return this;
        },
        async abortSignal() {
          return {
            data: [{ id: "cat", slug: "place", label: "Places" }],
            error: null,
            status: 200,
          };
        },
      }),
      rpc(name, args) {
        calls.push({ name, args });
        const response = async () => {
          if (calls.length === 1)
            return {
              data: null,
              error: { message: "connection lost" },
              status: 0,
            };
          if (calls.length === 2)
            return { data: null, error: { code: "23514" }, status: 400 };
          return {
            data: { id: args.p_forum_id ?? args.p_entity_id },
            error: null,
            status: 200,
          };
        };
        return {
          abortSignal() {
            return kind === "FIND" ? response() : this;
          },
          single: response,
        };
      },
    };
    const deps = {
      "@/lib/supabase/client": { supabase: client },
      "expo-crypto": { randomUUID: () => "new-id" },
      "./errors": errors,
      "./request": { runApiRequest },
    };
    const api = loadTypeScript(
      kind === "FORUM" ? "src/api/forums.ts" : "src/api/entities.ts",
      deps,
    );
    const attempt = { id: "stable-id" };
    const image = {
      contentType: "image/jpeg",
      extension: "jpg",
      data: new ArrayBuffer(1),
    };
    const input =
      kind === "FORUM"
        ? {
            attempt,
            ownerId: "user",
            name: "Forum",
            slug: "forum",
            description: null,
            rules: "",
            forumImage: image,
          }
        : {
            attempt,
            authorId: "user",
            name: "Find",
            categorySlug: "place",
            image,
          };
    const create = () =>
      kind === "FORUM" ? api.createForum(input) : api.createEntity(input);
    await assert.rejects(create());
    await assert.rejects(create());
    assert.equal(attempt.outcomeUncertain, true);
    assert.equal((await create()).id, "stable-id");
    assert.equal(attempt.outcomeUncertain, false);
    assert.equal(uploads, 1);
    assert.deepEqual(calls[0], calls[1]);
    assert.deepEqual(calls[1], calls[2]);
  }
});

test("resource recovery preserves uncertain operations and clears confirmed ones", async () => {
  const saved = [];
  const store = {
    save: async (_user, id) => saved.push(id),
    clearIfMatches: async (_user, id) => {
      saved.splice(saved.indexOf(id), 1);
      return true;
    },
  };
  const { submitResourceWithRecovery } = loadTypeScript(
    "src/services/creation/submit-resource-with-recovery.ts",
    {
      "./ask-recovery-store": { resourceRecoveryStores: { FIND: store } },
    },
  );
  const attempt = { id: "operation", outcomeUncertain: true };
  await assert.rejects(
    submitResourceWithRecovery("user", "FIND", attempt, async () => {
      throw new Error("lost");
    }),
  );
  assert.deepEqual(saved, ["operation"]);
  saved.length = 0;
  assert.equal(
    await submitResourceWithRecovery(
      "user",
      "FIND",
      attempt,
      async () => "confirmed",
    ),
    "confirmed",
  );
  assert.deepEqual(saved, []);
});

test("comment query keys include page size and share an invalidation prefix", () => {
  const { queryKeys } = loadTypeScript("src/lib/query/query-keys.ts");
  const small = queryKeys.comments.inlineByPost("post", "viewer-a", 2);
  const large = queryKeys.comments.inlineByPost("post", "viewer-a", 5);
  assert.notDeepEqual(small, large);
  assert.deepEqual(small.slice(0, 3), queryKeys.comments.byPostPrefix("post"));
  assert.notDeepEqual(
    queryKeys.comments.byPost("post", "viewer-a"),
    queryKeys.comments.byPost("post", "viewer-b"),
  );
});

test("home post hydration requests only global posts", async () => {
  const filters = [];
  const builder = {
    select() {
      return this;
    },
    in(column, values) {
      filters.push([column, values]);
      return this;
    },
    is(column, value) {
      filters.push([column, value]);
      return this;
    },
    abortSignal() {
      return Promise.resolve({ data: [], error: null, status: 200 });
    },
  };
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "expo-crypto": { randomUUID: () => "post-id" },
  });
  assert.deepEqual(await posts.getGlobalPostsByIds(["post"]), []);
  assert.deepEqual(filters, [
    ["id", ["post"]],
    ["forum_id", null],
  ]);
});

test("a Share rating with an unavailable post is an error, not an empty review", async () => {
  let row = { post_id: "post", score: 4, post: null };
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: row, error: null, status: 200 });
    },
  };
  const shares = loadTypeScript("src/api/shares.ts", {
    "@/api/posts": {},
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "expo-crypto": { randomUUID: () => "post-id" },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await assert.rejects(
    shares.getMyEntityRating("entity", "author"),
    (error) => error.message === errors.API_ERROR_MESSAGES.LOAD_YOUR_RATING,
  );
  row = { post_id: "post", score: 4, post: { body: null } };
  assert.deepEqual(await shares.getMyEntityRating("entity", "author"), {
    body: null,
    postId: "post",
    score: 4,
  });
});

test("forum image signing failures do not silently hide forum images", async () => {
  let signed = [
    { path: "owner/forum/image.jpg", signedUrl: "", error: "private detail" },
  ];
  const forum = {
    id: "forum",
    image_path: "owner/forum/image.jpg",
    cover_image_path: null,
  };
  const forums = loadTypeScript("src/api/forums.ts", {
    "@/lib/supabase/client": {
      supabase: {
        rpc() {
          return {
            abortSignal: async () => ({
              data: [forum],
              error: null,
              status: 200,
            }),
          };
        },
        storage: {
          from: () => ({
            createSignedUrls: async () => ({ data: signed, error: null }),
          }),
        },
      },
    },
    "expo-crypto": { randomUUID: () => "forum" },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  for (const result of [signed, []]) {
    signed = result;
    await assert.rejects(
      forums.getForums(),
      (error) => error.message === errors.API_ERROR_MESSAGES.LOAD_FORUM_IMAGES,
    );
  }
  signed = [{ path: forum.image_path, signedUrl: "signed-url", error: null }];
  assert.equal((await forums.getForums())[0].imageUrl, "signed-url");
});

test("forum deletion requires a returned row and uses a safe error otherwise", async () => {
  let data = { id: "forum" };
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null, status: 200 });
    },
  };
  const forums = loadTypeScript("src/api/forums.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "expo-crypto": { randomUUID: () => "forum" },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await forums.deleteForum("forum");
  data = null;
  await assert.rejects(
    forums.deleteForum("forum"),
    (error) => error.message === errors.API_ERROR_MESSAGES.DELETE_THIS_FORUM,
  );
});

test("leaving a forum requires a deleted membership and hides why no row matched", async () => {
  let data = { forum_id: "forum" };
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null, status: 200 });
    },
  };
  const forums = loadTypeScript("src/api/forums.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "expo-crypto": { randomUUID: () => "forum" },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await forums.leaveForum("forum", "member");
  data = null;
  await assert.rejects(
    forums.leaveForum("forum", "member"),
    (error) => error.message === errors.API_ERROR_MESSAGES.LEAVE_THIS_FORUM,
  );
});

test("Pick deletion requires a returned row and uses a safe error otherwise", async () => {
  let data = { id: "pick" };
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null, status: 200 });
    },
  };
  const picks = loadTypeScript("src/api/picks.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await picks.deletePersonalPick("pick");
  data = null;
  await assert.rejects(
    picks.deletePersonalPick("pick"),
    (error) => error.message === errors.API_ERROR_MESSAGES.DELETE_THIS_PICK,
  );
});

test("find deletion distinguishes an in-use find from an absent or denied one", async () => {
  let response = { data: { id: "find" }, error: null, status: 200 };
  const builder = {
    delete() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve(response);
    },
  };
  const entities = loadTypeScript("src/api/entities.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "expo-crypto": { randomUUID: () => "find" },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await entities.deleteEntity("find");
  response = { data: null, error: null, status: 200 };
  await assert.rejects(
    entities.deleteEntity("find"),
    (error) => error.message === errors.API_ERROR_MESSAGES.FIND_DELETE_DENIED,
  );
  response = {
    data: null,
    error: { code: "23503", message: "private database detail" },
    status: 409,
  };
  await assert.rejects(
    entities.deleteEntity("find"),
    (error) =>
      error.code === errors.API_ERROR_CODES.CONFLICT &&
      error.message === errors.API_ERROR_MESSAGES.FIND_IN_USE,
  );
});

test("unfollow accepts zero rows and safely reports database errors", async () => {
  let response = { error: null, status: 204 };
  const filters = [];
  const builder = {
    delete() {
      return this;
    },
    eq(column, value) {
      filters.push([column, value]);
      return this;
    },
    abortSignal() {
      return Promise.resolve(response);
    },
  };
  const follows = loadTypeScript("src/api/follows.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await follows.unfollowProfile("follower", "target");
  assert.deepEqual(filters, [
    ["follower_id", "follower"],
    ["following_id", "target"],
  ]);
  response = { error: { message: "private database detail" }, status: 500 };
  await assert.rejects(
    follows.unfollowProfile("follower", "target"),
    (error) => error.message === errors.API_ERROR_MESSAGES.UNFOLLOW_THIS_PERSON,
  );
});

test("unfollowing a Pick accepts zero rows and reports database errors safely", async () => {
  let response = { error: null, status: 204 };
  const filters = [];
  const builder = {
    delete() {
      return this;
    },
    eq(column, value) {
      filters.push([column, value]);
      return this;
    },
    abortSignal() {
      return Promise.resolve(response);
    },
  };
  const picks = loadTypeScript("src/api/picks.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await picks.setPickFollow("user", "pick", false);
  assert.deepEqual(filters, [
    ["user_id", "user"],
    ["pick_id", "pick"],
  ]);
  response = { error: { message: "private detail" }, status: 500 };
  await assert.rejects(
    picks.setPickFollow("user", "pick", false),
    (error) =>
      error.message === errors.API_ERROR_MESSAGES.UPDATE_THE_FOLLOWED_PICK,
  );
});

test("followed Pick IDs use a deterministic order when paginating", async () => {
  const ordering = [];
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order(column, options) {
      ordering.push([column, options]);
      return this;
    },
    range() {
      return this;
    },
    abortSignal() {
      return Promise.resolve({
        data: [{ pick_id: "pick" }],
        error: null,
        status: 200,
      });
    },
  };
  const picks = loadTypeScript("src/api/picks.ts", {
    "@/lib/supabase/client": { supabase: { from: () => builder } },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  assert.deepEqual(await picks.getFollowedPickIds("user"), ["pick"]);
  assert.deepEqual(ordering, [["pick_id", { ascending: true }]]);
});

test("discovery requests routable profiles and excludes forum posts", async () => {
  const filters = [];
  const client = {
    from(table) {
      return {
        select() {
          return this;
        },
        not(...args) {
          filters.push([table, "not", ...args]);
          return this;
        },
        or() {
          return this;
        },
        ilike() {
          return this;
        },
        is(...args) {
          filters.push([table, "is", ...args]);
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        abortSignal() {
          return Promise.resolve({ data: [], error: null, status: 200 });
        },
      };
    },
  };
  const discover = loadTypeScript("src/api/discover.ts", {
    "@/api/entities": { searchEntities: async () => [] },
    "@/lib/supabase/client": { supabase: client },
    "./errors": errors,
    "./request": { runApiRequest },
  });
  await discover.discover("test");
  assert.deepEqual(filters, [
    ["profiles", "not", "username", "is", null],
    ["posts", "is", "forum_id", null],
  ]);
});

test("activity makes at most one automatic mark-read attempt per unread set", () => {
  const { shouldAutoMarkRead } = loadTypeScript(
    "src/features/activity/mark-read.ts",
  );
  const key = JSON.stringify(["user", "notification"]);
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: key,
      lastAutoAttempt: null,
      pending: false,
      failed: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: key,
      lastAutoAttempt: key,
      pending: false,
      failed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: key,
      lastAutoAttempt: key,
      pending: false,
      failed: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: "new",
      lastAutoAttempt: key,
      pending: false,
      failed: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: "new",
      lastAutoAttempt: key,
      pending: true,
      failed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: "new",
      lastAutoAttempt: key,
      pending: false,
      failed: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoMarkRead({
      unreadKey: null,
      lastAutoAttempt: key,
      pending: false,
      failed: false,
    }),
    false,
  );
});

test("initializing a Share draft preserves fields edited before the rating arrives", () => {
  const { initializeShareDraft } = loadTypeScript(
    "src/features/create/share-draft.ts",
  );
  const current = { score: 4, body: "My unfinished review" };
  const saved = { score: 2, body: "Earlier review" };
  assert.deepEqual(
    initializeShareDraft(current, saved, { score: false, body: true }),
    { score: 2, body: "My unfinished review" },
  );
  assert.deepEqual(
    initializeShareDraft(current, saved, { score: true, body: false }),
    { score: 4, body: "Earlier review" },
  );
  assert.deepEqual(
    initializeShareDraft(current, null, { score: true, body: true }),
    current,
  );
  assert.deepEqual(
    initializeShareDraft(current, null, { score: false, body: false }),
    { score: null, body: "" },
  );
});

test("Share publishing waits for a successful existing-rating lookup", () => {
  const { canPublishShare } = loadTypeScript(
    "src/features/create/share-draft.ts",
  );
  const base = {
    signedIn: true,
    hasEntity: true,
    score: 4,
    saving: false,
    ratingLookupSucceeded: true,
    ratingLookupFailed: false,
  };
  assert.equal(canPublishShare(base), true);
  assert.equal(
    canPublishShare({ ...base, ratingLookupSucceeded: false }),
    false,
  );
  assert.equal(canPublishShare({ ...base, ratingLookupFailed: true }), false);
  assert.equal(canPublishShare({ ...base, saving: true }), false);
  assert.equal(canPublishShare({ ...base, hasEntity: false }), false);
});

test("inline drafts survive store subscribers and stale submissions cannot clear newer text", () => {
  const { useInlineDrafts } = loadTypeScript(
    "src/features/comments/inline-drafts.ts",
  );
  const store = useInlineDrafts;
  const key = JSON.stringify(["user", "post"]);
  store.getState().update(key, (draft) => ({
    ...draft,
    body: "first",
    bodyRevision: draft.bodyRevision + 1,
  }));
  const unsubscribe = store.subscribe(() => {});
  unsubscribe();
  assert.equal(store.getState().drafts[key].body, "first");
  const token = store.getState().begin(key, "comment");
  assert.equal(store.getState().begin(key, "comment"), null);
  store.getState().update(key, (draft) => ({
    ...draft,
    body: "new draft",
    bodyRevision: draft.bodyRevision + 1,
  }));
  store.getState().finish(key, "comment", token, true);
  assert.equal(store.getState().drafts[key].body, "new draft");
  const retry = store.getState().begin(key, "comment");
  store.getState().finish(key, "comment", retry, false, "Could not post.");
  assert.equal(store.getState().drafts[key].body, "new draft");
  assert.equal(store.getState().drafts[key].commentError, "Could not post.");
  const last = store.getState().begin(key, "comment");
  store.getState().clearAll();
  store.getState().finish(key, "comment", last, true);
  assert.equal(store.getState().drafts[key], undefined);
});

test("inline reply drafts are scoped by user and post and survive failed requests", () => {
  const { useInlineDrafts: store } = loadTypeScript(
    "src/features/comments/inline-drafts.ts",
  );
  const first = JSON.stringify(["user-a", "post"]);
  const second = JSON.stringify(["user-b", "post"]);
  store.getState().update(first, (draft) => ({
    ...draft,
    replyTargetId: "comment",
    replyBody: "reply",
    replyRevision: draft.replyRevision + 1,
  }));
  const token = store.getState().begin(first, "reply");
  store.getState().finish(first, "reply", token, false, "Could not reply.");
  assert.equal(store.getState().drafts[first].replyBody, "reply");
  assert.equal(store.getState().drafts[first].replyTargetId, "comment");
  assert.equal(store.getState().drafts[second], undefined);
  const next = store.getState().begin(first, "reply");
  store.getState().finish(first, "reply", next, true);
  assert.equal(store.getState().drafts[first], undefined);
  store.getState().clearAll();
});

test("notification reads reject missing actors and preserve safe error messages", async () => {
  let response = { data: [{ actor: null }], error: null, status: 200 };
  const chain = {};
  for (const name of ["select", "eq", "order", "range"])
    chain[name] = () => chain;
  chain.abortSignal = async () => response;
  const notifications = loadTypeScript("src/api/notifications.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": { supabase: { from: () => chain } },
  });
  await assert.rejects(
    notifications.getNotifications("user"),
    (error) =>
      error.code === errors.API_ERROR_CODES.UNKNOWN_ERROR &&
      error.message === errors.API_ERROR_MESSAGES.LOAD_ACTIVITY,
  );
  response = { data: null, error: { message: "private detail" }, status: 403 };
  await assert.rejects(
    notifications.getNotifications("user"),
    (error) =>
      error.code === errors.API_ERROR_CODES.FORBIDDEN &&
      error.status === 403 &&
      !error.message.includes("private"),
  );
});

test("post deletion rejects when no row was deleted", async () => {
  const chain = {};
  for (const name of ["delete", "eq", "select", "abortSignal"])
    chain[name] = () => chain;
  let data = { id: "post" };
  chain.maybeSingle = async () => ({ data, error: null, status: 200 });
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": { supabase: { from: () => chain } },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  await posts.deletePost("post");
  data = null;
  await assert.rejects(
    posts.deletePost("post"),
    (error) =>
      error instanceof errors.ApiError &&
      error.message === errors.API_ERROR_MESSAGES.DELETE_THIS_POST,
  );
});

test("uncertain Ask creation does not delete a potentially referenced upload", async () => {
  let removals = 0;
  const client = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => {
          removals++;
          return { error: null };
        },
      }),
    },
    rpc: () => ({
      abortSignal() {
        return this;
      },
      async single() {
        return { data: null, error: { message: "connection lost" }, status: 0 };
      },
    }),
  };
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": { supabase: client },
    "expo-crypto": { randomUUID: () => "post-id" },
  });
  await assert.rejects(
    posts.createAskPost({
      authorId: "user",
      body: "Question?",
      images: [
        {
          data: new ArrayBuffer(1),
          contentType: "image/jpeg",
          extension: "jpg",
        },
      ],
    }),
    (error) =>
      error.code === errors.API_ERROR_CODES.NETWORK_ERROR && !error.retryable,
  );
  assert.equal(removals, 0);
});

test("normal Ask creation calls the idempotent RPC with its generated identity", async () => {
  let call;
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        rpc(name, args) {
          call = { name, args };
          return {
            abortSignal() {
              return this;
            },
            async single() {
              return { data: { id: args.p_post_id }, error: null, status: 200 };
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "post-id" },
  });
  await posts.createAskPost({
    authorId: "user",
    body: "Question?",
    images: [],
  });
  assert.equal(call.name, "create_ask_post_idempotent");
  assert.equal(call.args.p_operation_id, "post-id");
  assert.equal(call.args.p_post_id, "post-id");
});

test("Ask creation lookup distinguishes confirmation from an inconclusive result", async () => {
  let response = { data: { id: "post" }, error: null, status: 200 };
  let request;
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        rpc(name, args) {
          request = { name, args };
          return {
            abortSignal() {
              return this;
            },
            maybeSingle: async () => response,
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  assert.deepEqual(await posts.lookupAskCreation("operation"), {
    status: "confirmed",
    post: { id: "post" },
  });
  assert.deepEqual(request, {
    name: "lookup_ask_creation",
    args: { p_operation_id: "operation" },
  });
  response = { data: null, error: null, status: 200 };
  assert.deepEqual(await posts.lookupAskCreation("operation"), {
    status: "inconclusive",
  });
  response = { data: null, error: { message: "private detail" }, status: 403 };
  await assert.rejects(
    posts.lookupAskCreation("operation"),
    (error) =>
      error.message === errors.API_ERROR_MESSAGES.CHECK_ASK_CREATION &&
      error.status === 403,
  );
});

test("retrying the same Ask attempt reuses uploaded paths and operation identity", async () => {
  let uploads = 0;
  const calls = [];
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        storage: {
          from: () => ({
            upload: async () => {
              uploads++;
              return { error: null };
            },
          }),
        },
        rpc(_name, args) {
          calls.push(args);
          return {
            abortSignal() {
              return this;
            },
            async single() {
              return calls.length === 1
                ? {
                    data: null,
                    error: { message: "connection lost" },
                    status: 0,
                  }
                : { data: { id: args.p_post_id }, error: null, status: 200 };
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  const attempt = { id: "stable-id" };
  const input = {
    authorId: "user",
    body: "Question?",
    images: [
      { data: new ArrayBuffer(1), contentType: "image/jpeg", extension: "jpg" },
    ],
    attempt,
  };
  await assert.rejects(posts.createAskPost(input));
  assert.equal(attempt.outcomeUncertain, true);
  assert.equal((await posts.createAskPost(input)).id, "stable-id");
  assert.equal(attempt.outcomeUncertain, false);
  assert.equal(uploads, 1);
  assert.deepEqual(calls[0], calls[1]);
});

test("post creation retries retain identity, paths, and unresolved outcomes", async () => {
  const calls = [];
  let uploads = 0;
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        storage: {
          from: () => ({
            upload: async () => {
              uploads++;
              return { error: null };
            },
          }),
        },
        rpc(name, args) {
          calls.push({ name, args });
          return {
            abortSignal() {
              return this;
            },
            async single() {
              if (calls.length === 1)
                return { data: null, error: { message: "lost" }, status: 0 };
              if (calls.length === 2)
                return { data: null, error: { code: "23514" }, status: 400 };
              return { data: { id: args.p_post_id }, error: null, status: 200 };
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  const attempt = { id: "stable-id" };
  const input = {
    authorId: "user",
    attempt,
    kind: "FORUM_ASK",
    forumId: "forum",
    body: "Question?",
    images: [
      { data: new ArrayBuffer(1), contentType: "image/jpeg", extension: "jpg" },
    ],
  };
  await assert.rejects(posts.createIdempotentPost(input));
  await assert.rejects(posts.createIdempotentPost(input));
  assert.equal(attempt.outcomeUncertain, true);
  assert.equal((await posts.createIdempotentPost(input)).id, "stable-id");
  assert.equal(attempt.outcomeUncertain, false);
  assert.equal(uploads, 1);
  assert.equal(calls[0].name, "create_post_idempotent");
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[1], calls[2]);
});

test("a timed-out Ask retry retains its identity until the result is confirmed", async () => {
  const calls = [];
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": {
      runApiRequest: (fn, options) =>
        runApiRequest(fn, { ...options, timeoutMs: 10 }),
    },
    "@/lib/supabase/client": {
      supabase: {
        rpc(_name, args) {
          calls.push(args);
          let signal;
          return {
            abortSignal(value) {
              signal = value;
              return this;
            },
            single() {
              if (calls.length > 1)
                return Promise.resolve({
                  data: { id: args.p_post_id },
                  error: null,
                  status: 200,
                });
              return new Promise((_, reject) =>
                signal.addEventListener(
                  "abort",
                  () => reject(new Error("aborted")),
                  { once: true },
                ),
              );
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  const attempt = { id: "stable-id" };
  const input = { authorId: "user", body: "Question?", images: [], attempt };
  await assert.rejects(
    posts.createAskPost(input),
    (error) => error.code === errors.API_ERROR_CODES.TIMEOUT,
  );
  assert.equal(attempt.outcomeUncertain, true);
  assert.equal((await posts.createAskPost(input)).id, "stable-id");
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(attempt.outcomeUncertain, false);
});

test("a definite PostgreSQL rejection permits editing an Ask attempt", async () => {
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        rpc: () => ({
          abortSignal() {
            return this;
          },
          async single() {
            return {
              data: null,
              error: { code: "23514", message: "private detail" },
              status: 400,
            };
          },
        }),
      },
    },
    "expo-crypto": { randomUUID: () => "unused" },
  });
  const attempt = { id: "stable-id" };
  await assert.rejects(
    posts.createAskPost({
      authorId: "user",
      body: "Question?",
      images: [],
      attempt,
    }),
  );
  assert.equal(attempt.outcomeUncertain, false);
});

test("partial Ask upload failure attempts cleanup before any database write", async () => {
  for (const cleanupError of [null, { message: "cleanup failed" }]) {
    let uploads = 0;
    let rpcCalls = 0;
    const removed = [];
    const posts = loadTypeScript("src/api/posts.ts", {
      "./errors": errors,
      "./request": { runApiRequest },
      "@/lib/supabase/client": {
        supabase: {
          storage: {
            from: () => ({
              upload: async () => ({
                error:
                  ++uploads === 2 ? { message: "private upload detail" } : null,
              }),
              remove: async (paths) => {
                removed.push(paths);
                return { error: cleanupError };
              },
            }),
          },
          rpc: () => {
            rpcCalls++;
            throw new Error("unexpected database write");
          },
        },
      },
      "expo-crypto": { randomUUID: () => "unused" },
    });
    const image = {
      data: new ArrayBuffer(1),
      contentType: "image/jpeg",
      extension: "jpg",
    };
    const attempt = { id: "post-id" };
    await assert.rejects(
      posts.createAskPost({
        authorId: "user",
        body: "Question?",
        images: [image, image],
        attempt,
      }),
      (error) =>
        error.message ===
        errors.API_ERROR_MESSAGES.AN_IMAGE_COULD_NOT_BE_UPLOADED,
    );
    assert.deepEqual(removed, [["user/post-id/1.jpg"]]);
    assert.equal(rpcCalls, 0);
    assert.equal(attempt.uploadedPaths, undefined);
    assert.equal(attempt.id, "unused");
  }
});

test("Ask retry uses a fresh upload location after partial upload failure", async () => {
  const paths = [];
  let rpcArgs;
  const posts = loadTypeScript("src/api/posts.ts", {
    "./errors": errors,
    "./request": { runApiRequest },
    "@/lib/supabase/client": {
      supabase: {
        storage: {
          from: () => ({
            upload: async (path) => {
              paths.push(path);
              return { error: paths.length === 2 ? { message: "lost" } : null };
            },
            remove: async () => ({ error: { message: "cleanup failed" } }),
          }),
        },
        rpc: (_name, args) => {
          rpcArgs = args;
          return {
            abortSignal() {
              return this;
            },
            async single() {
              return { data: { id: args.p_post_id }, error: null, status: 200 };
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "new-id" },
  });
  const image = {
    data: new ArrayBuffer(1),
    contentType: "image/jpeg",
    extension: "jpg",
  };
  const attempt = { id: "old-id" };
  const input = {
    authorId: "user",
    body: "Question?",
    images: [image, image],
    attempt,
  };
  await assert.rejects(posts.createAskPost(input));
  await posts.createAskPost(input);
  assert.deepEqual(paths, [
    "user/old-id/1.jpg",
    "user/old-id/2.jpg",
    "user/new-id/1.jpg",
    "user/new-id/2.jpg",
  ]);
  assert.equal(rpcArgs.p_operation_id, "new-id");
});
