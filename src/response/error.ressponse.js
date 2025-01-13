const ReasonStatusCode = {
    BAD_REQUEST: 'Invalid Data',
    CONFLICT: 'Conflict Data',
    NOT_FOUND: 'Not Found Data',
    UNAUTHORIZED: 'Invalid Authentication Information',
    FORBIDDEN: 'Not Permission Access',
    INTERNAL_ERROR_SERVER: 'Internal Error Server'
}

const StatusCode = {
    BAD_REQUEST: 400,
    CONFLICT: 409,
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    INTERNAL_ERROR_SERVER: 500
}

class ErrorResponse extends Error {
    constructor(message, status) {
        super(message)
        this.status = status
    }
}

class ConflictRequestError extends ErrorResponse {
    constructor(message = ReasonStatusCode.CONFLICT, status = StatusCode.CONFLICT) {
        super(message, status)
    }
}

class BadRequestError extends ErrorResponse {
    constructor(message = ReasonStatusCode.BAD_REQUEST, status = StatusCode.BAD_REQUEST) {
        super(message, status)
    }
}

class NotFoundError extends ErrorResponse {
    constructor(message = ReasonStatusCode.NOT_FOUND, status = StatusCode.NOT_FOUND) {
        super(message, status)
    }
}

class UnauthorizedError extends ErrorResponse {
    constructor(message = ReasonStatusCode.UNAUTHORIZED, status = StatusCode.UNAUTHORIZED) {
        super(message, status)
    }
}

class ForbiddenError extends ErrorResponse {
    constructor(message = ReasonStatusCode.FORBIDDEN, status = StatusCode.FORBIDDEN) {
        super(message, status)
    }
}

class InternalServerError extends ErrorResponse {
    constructor(message = ReasonStatusCode.INTERNAL_ERROR_SERVER, status = StatusCode.INTERNAL_ERROR_SERVER) {
        super(message, status)
    }
}

module.exports = {
    ConflictRequestError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    InternalServerError
}
