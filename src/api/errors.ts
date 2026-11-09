export const API_ERROR_CODES = {
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  NETWORK_ERROR: "NETWORK_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_ERROR: "SERVER_ERROR",
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",
  USERNAME_TAKEN: "USERNAME_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_CONFIRMED: "EMAIL_NOT_CONFIRMED",
  SAME_PASSWORD: "SAME_PASSWORD",
} as const;

export const API_ERROR_MESSAGES = {
  UNKNOWN: "Something went wrong. Please try again.",
  TIMEOUT: "The request timed out. Please try again.",
  CANCELLED: "The request was cancelled.",
  USERNAME_TAKEN: "That username is already taken.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  EMAIL_NOT_CONFIRMED: "Confirm your email before signing in.",
  PASSWORD_RESET_LINK_INVALID:
    "This password reset link may have expired. Request a new one and try again.",
  PASSWORD_RESET_LINK_UNAVAILABLE:
    "We couldn’t open the password reset link. Request a new one and try again.",
  SAME_PASSWORD: "Choose a different password from your current one.",
  SIGN_IN: "We couldn’t sign you in. Please try again.",
  SIGN_UP: "We couldn’t create your account. Please try again.",
  RESET_PASSWORD: "We couldn’t send reset instructions. Please try again.",
  UPDATE_PASSWORD: "We couldn’t update your password. Please try again.",
  SIGN_OUT: "We couldn’t sign you out. Please try again.",
  DELETE_ACCOUNT: "We couldn’t delete your account. Please try again.",
  LOAD_THE_COMMENT_COUNT: "We could not load the comment count.",
  LOAD_THE_COMMENTS: "We could not load the comments.",
  LOAD_THE_REPLIES: "We could not load the replies.",
  POST_YOUR_COMMENT: "We could not post your comment.",
  UPDATE_YOUR_COMMENT: "We could not update your comment.",
  DELETE_YOUR_COMMENT: "We could not delete your comment.",
  A_COMMENT_MUST_BE_BETWEEN_1_AND_2_000_CHARACTERS:
    "A comment must be between 1 and 2,000 characters.",
  SEARCH_PEOPLE: "We could not search people.",
  SEARCH_POSTS: "We could not search posts.",
  LOAD_CATEGORIES: "We could not load categories.",
  UPLOAD_THE_FIND_IMAGE: "We could not upload the find image.",
  ADD_THIS_FIND: "We could not add this find.",
  LOAD_THIS_FIND: "We could not load this find.",
  LOAD_FINDS: "We could not load finds.",
  SEARCH_FINDS: "We could not search finds.",
  DELETE_THIS_FIND: "We could not delete this find.",
  FIND_IN_USE: "This find is used in posts or Picks and cannot be deleted.",
  FIND_DELETE_DENIED: "You cannot delete this find.",
  FIND_RELOAD_FAILED: "The find was added but could not be reloaded.",
  A_FIND_NAME_IS_REQUIRED: "A find name is required.",
  CHOOSE_ENTITY_CATEGORY: "Choose a valid find category.",
  THE_FIND_IMAGE_MUST_BE_SMALLER_THAN_10_MB:
    "The find image must be smaller than 10 MB.",
  LOAD_YOUR_FEED: "We could not load your feed.",
  LOAD_SHARE_RATINGS: "We could not load ratings.",
  CHECK_THE_FOLLOW_STATUS: "We could not check the follow status.",
  FOLLOW_THIS_PERSON: "We could not follow this person.",
  UNFOLLOW_THIS_PERSON: "We could not unfollow this person.",
  LOAD_FOLLOWERS: "We could not load followers.",
  LOAD_FOLLOWING: "We could not load following.",
  DELETE_THIS_FORUM: "We could not delete this forum.",
  CREATE_THIS_FORUM: "We could not create this forum.",
  UPLOAD_FORUM_IMAGE: "We could not upload the forum image.",
  UPLOAD_FORUM_COVER: "We could not upload the forum cover.",
  LOAD_FORUMS: "We could not load forums.",
  LOAD_THIS_FORUM: "We could not load this forum.",
  LOAD_FORUM_IMAGES: "We could not load forum images.",
  JOIN_THIS_FORUM: "We could not join this forum.",
  LEAVE_THIS_FORUM: "We could not leave this forum.",
  DELETE_THIS_PICK: "We could not delete this Pick.",
  LOAD_THIS_PICK: "We could not load this Pick.",
  LOAD_THE_FINDS_IN_THIS_PICK: "We could not load the finds in this Pick.",
  LOAD_PICKS: "We could not load Picks.",
  SAVE_THIS_PICK: "We could not save this Pick.",
  LOAD_FOLLOWED_PICKS: "We could not load followed Picks.",
  UPDATE_THE_FOLLOWED_PICK: "We could not update the followed Pick.",
  GIVE_YOUR_PICK_A_TITLE: "Give your Pick a title.",
  ADD_AT_LEAST_ONE_FIND_TO_YOUR_PICK: "Add at least one find to your Pick.",
  CHOOSE_A_PICK_TO_UPDATE: "Choose a Pick to update.",
  CREATE_YOUR_ASK_POST: "We could not create your Ask post.",
  CHECK_ASK_CREATION: "We could not check whether your Ask post was published.",
  PUBLISH_THIS_FORUM_POST: "We could not publish this forum post.",
  ATTACH_THE_IMAGES_TO_YOUR_POST:
    "We could not attach the images to your post.",
  AN_IMAGE_COULD_NOT_BE_UPLOADED: "An image could not be uploaded.",
  INVALID_IMAGE_TYPE: "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.",
  READ_IMAGE: "We could not read the selected image. Please choose it again.",
  PREPARE_THE_IMAGE_UPLOAD: "We could not prepare the image upload.",
  CLEAN_UP_POST_IMAGES: "We could not clean up post images.",
  LOAD_THIS_POST: "We could not load this post.",
  LOAD_FEED_POSTS: "We could not load feed posts.",
  LOAD_POST_ENGAGEMENT: "We could not load post engagement details.",
  LOAD_ASK_POSTS: "We could not load Ask posts.",
  LOAD_FORUM_POSTS: "We could not load forum posts.",
  UPDATE_THIS_ASK_POST: "We could not update this Ask post.",
  DELETE_THIS_POST: "We could not delete this post.",
  IMAGE_CLEANUP_WILL_BE_RETRIED: "Image cleanup will be retried.",
  RESUME_IMAGE_CLEANUP: "We could not resume image cleanup.",
  LOAD_POST_IMAGES: "We could not load post images.",
  THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER:
    "The description must be 2,000 characters or fewer.",
  ADD_YOUR_QUESTION_BEFORE_SAVING: "Add your question before saving.",
  YOU_MUST_BE_SIGNED_IN_TO_CREATE_A_POST:
    "You must be signed in to create a post.",
  ADD_YOUR_QUESTION_BEFORE_PUBLISHING: "Add your question before publishing.",
  AN_ASK_POST_CAN_CONTAIN_UP_TO_THREE_IMAGES:
    "An Ask post can contain up to three images.",
  EACH_IMAGE_MUST_BE_SMALLER_THAN_10_MB:
    "Each image must be smaller than 10 MB.",
  YOU_MUST_BE_SIGNED_IN_TO_PUBLISH_A_FORUM_POST:
    "You must be signed in to publish a forum post.",
  AN_ASK_POST_CANNOT_INCLUDE_A_FIND: "An Ask post cannot include a find.",
  CHOOSE_A_FIND_TO_SHARE: "Choose a find to share.",
  LOAD_YOUR_PROFILE: "We could not load your profile.",
  LOAD_THIS_PROFILE: "We could not load this profile.",
  LOAD_FOLLOWER_TOTALS: "We could not load follower totals.",
  LOAD_FOLLOWING_TOTALS: "We could not load following totals.",
  UPDATE_YOUR_PROFILE: "We could not update your profile.",
  LOAD_THE_RATING_SUMMARY: "We could not load the rating summary.",
  LOAD_YOUR_RATING: "We could not load your rating.",
  UPDATE_YOUR_RATING: "We could not update your rating.",
  CREATE_YOUR_RATING: "We could not create your rating.",
  REMOVE_YOUR_RATING: "We could not remove your rating.",
  CHOOSE_A_RATING_FROM_1_TO_5: "Choose a rating from 1 to 5.",
  LOAD_THIS_FIND_S_RATING: "We could not load this find’s rating.",
  LOAD_THIS_RATING: "We could not load this rating.",
  LOAD_RATINGS: "We could not load ratings.",
  PUBLISH_YOUR_RATING: "We could not publish your rating.",
  THE_REVIEW_MUST_BE_2_000_CHARACTERS_OR_FEWER:
    "The review must be 2,000 characters or fewer.",
  CHOOSE_A_FIND_BEFORE_PUBLISHING: "Choose a find before publishing.",
  A_RATING_CAN_CONTAIN_UP_TO_THREE_IMAGES:
    "A rating can contain up to three images.",
  LOAD_ACTIVITY: "We could not load your activity. Please try again.",
  MARK_ACTIVITY_READ:
    "We could not mark your activity as read. Please try again.",
} as const;

const POSTGRES_ERROR_CODES = {
  CONFLICT: ["23505", "23503"],
  VALIDATION: ["23502", "23514"],
  FORBIDDEN: ["42501"],
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type ApiFieldErrors = Readonly<Record<string, string>>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly fieldErrors?: ApiFieldErrors;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      code?: ApiErrorCode;
      fieldErrors?: ApiFieldErrors;
      retryable?: boolean;
      status?: number;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = options.code ?? API_ERROR_CODES.UNKNOWN_ERROR;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.fieldErrors = options.fieldErrors;
  }
}

export function normalizeApiError(
  error: unknown,
  message: string = API_ERROR_MESSAGES.UNKNOWN,
  status?: number,
): ApiError {
  if (error instanceof ApiError) return error;

  const details = typeof error === "object" && error !== null ? error : {};
  const errorStatus =
    "status" in details && typeof details.status === "number"
      ? details.status
      : undefined;
  const responseStatus = status ?? errorStatus;
  const providerCode =
    "code" in details && typeof details.code === "string"
      ? details.code
      : undefined;
  const code = mapProviderErrorCode(responseStatus, providerCode);

  return new ApiError(message, { cause: error, code, status: responseStatus });
}

function mapProviderErrorCode(
  status: number | undefined,
  providerCode: string | undefined,
): ApiErrorCode {
  if (status === 0) return API_ERROR_CODES.NETWORK_ERROR;
  if (status === 401) return API_ERROR_CODES.UNAUTHENTICATED;
  if (
    status === 403 ||
    POSTGRES_ERROR_CODES.FORBIDDEN.some((code) => code === providerCode)
  )
    return API_ERROR_CODES.FORBIDDEN;
  if (status === 429) return API_ERROR_CODES.RATE_LIMITED;
  if (
    status === 409 ||
    POSTGRES_ERROR_CODES.CONFLICT.some((code) => code === providerCode)
  )
    return API_ERROR_CODES.CONFLICT;
  if (
    providerCode?.startsWith("22") ||
    POSTGRES_ERROR_CODES.VALIDATION.some((code) => code === providerCode)
  )
    return API_ERROR_CODES.VALIDATION_ERROR;
  if (status !== undefined && status >= 500)
    return API_ERROR_CODES.SERVER_ERROR;
  return API_ERROR_CODES.UNKNOWN_ERROR;
}

export function normalizeStorageError(
  error: unknown,
  fallback: string,
): ApiError {
  const details = typeof error === "object" && error !== null ? error : {};
  const rawStatus = "status" in details ? details.status : undefined;
  const rawStatusCode =
    "statusCode" in details ? details.statusCode : undefined;
  const status =
    typeof rawStatus === "number"
      ? rawStatus
      : typeof rawStatusCode === "number"
        ? rawStatusCode
        : typeof rawStatusCode === "string" && /^\d{3}$/.test(rawStatusCode)
          ? Number(rawStatusCode)
          : undefined;
  return normalizeApiError(error, fallback, status);
}

export function validationError(
  message: string,
  fieldErrors?: ApiFieldErrors,
): ApiError {
  return new ApiError(message, {
    code: API_ERROR_CODES.VALIDATION_ERROR,
    fieldErrors,
  });
}

export function unauthenticatedError(message: string): ApiError {
  return new ApiError(message, { code: API_ERROR_CODES.UNAUTHENTICATED });
}

export function normalizeAuthError(error: unknown, fallback: string): ApiError {
  if (typeof error === "object" && error !== null && "code" in error) {
    const known =
      error.code === "invalid_credentials"
        ? ([
            API_ERROR_CODES.INVALID_CREDENTIALS,
            API_ERROR_MESSAGES.INVALID_CREDENTIALS,
          ] as const)
        : error.code === "email_not_confirmed"
          ? ([
              API_ERROR_CODES.EMAIL_NOT_CONFIRMED,
              API_ERROR_MESSAGES.EMAIL_NOT_CONFIRMED,
            ] as const)
          : error.code === "same_password"
            ? ([
                API_ERROR_CODES.SAME_PASSWORD,
                API_ERROR_MESSAGES.SAME_PASSWORD,
              ] as const)
            : null;
    if (known) {
      const status =
        "status" in error && typeof error.status === "number"
          ? error.status
          : undefined;
      return new ApiError(known[1], { code: known[0], cause: error, status });
    }
  }
  return normalizeApiError(error, fallback);
}
