# Cursor AI Engineering Rules

## Core Principles

You are a professional software engineer. Your code should be:
- **Production-ready**: Always write code as if it will be deployed to production
- **Maintainable**: Future developers (including yourself) should be able to understand and modify your code easily
- **Testable**: Write code that can be easily tested, and include tests when appropriate
- **Secure**: Consider security implications in every decision
- **Performant**: Optimize for performance, but not at the expense of readability
- **Type-safe**: Leverage TypeScript's type system to catch errors at compile time

## Code Quality Standards

### TypeScript Best Practices
- Always use explicit types for function parameters and return values
- Avoid `any` type - use `unknown` or proper types instead
- Use interfaces for object shapes, types for unions/intersections
- Leverage type inference where it improves readability
- Use const assertions and readonly modifiers where appropriate

### Code Organization
- Follow single responsibility principle - each function/class should do one thing well
- Keep functions small and focused (ideally < 50 lines)
- Extract complex logic into well-named helper functions
- Group related functionality together
- Use meaningful variable and function names that express intent

### Error Handling
- Always handle errors explicitly - never silently swallow exceptions
- Use proper error types and provide meaningful error messages
- Consider edge cases and failure modes
- Validate input at boundaries (API endpoints, function parameters)
- Use try-catch blocks appropriately, but don't catch errors you can't handle

### Async/Await
- Prefer async/await over promises chains for readability
- Always handle promise rejections (use try-catch or .catch())
- Consider race conditions and use Promise.all/Promise.allSettled when appropriate
- Don't create unnecessary async functions

## Architecture & Design

### API Design
- Design RESTful APIs with proper HTTP methods and status codes
- Use consistent naming conventions (camelCase for variables, PascalCase for classes)
- Version APIs appropriately
- Return consistent response structures
- Document API contracts clearly

### Separation of Concerns
- Separate business logic from presentation
- Keep API routes thin - delegate to service layers
- Avoid tight coupling between components
- Use dependency injection where appropriate

### Data Management
- Validate and sanitize all user input
- Use parameterized queries/prepared statements to prevent SQL injection
- Handle database transactions properly
- Consider data consistency and race conditions

### Database Migrations with Liquibase
- **Always use Liquibase for schema changes** - never modify the database schema directly
- **Use XML format for changelog structure** - keep the XML structure for changeset tracking
- **One changeset per logical change** - group related changes together, but separate unrelated changes
- **Use descriptive changeset IDs** - format: `XXX-descriptive-name` (e.g., `001-initial-schema`, `002-add-user-roles`)
- **Always include author** - use your name/username in the author field
- **Never modify existing changesets** - once a changeset is applied, create a new one for changes
- **Test migrations** - always test migrations on a development database before applying to production
- **Include rollback strategies** - consider how to rollback changes if needed
- **Keep migrations small and focused** - large migrations are harder to review and debug
- **Update master.xml** - always include new changelog files in `db/changelog/master.xml`
- **Use transactions** - Liquibase runs each changeset in a transaction by default
- **Version control migrations** - all migration files must be committed to version control

## Security

- Never commit secrets, API keys, or credentials to version control
- Use environment variables for configuration
- Implement proper authentication and authorization
- Sanitize user input to prevent XSS and injection attacks
- Use HTTPS in production
- Follow principle of least privilege
- Keep dependencies up to date to avoid known vulnerabilities

## Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Test edge cases and error conditions
- Aim for high code coverage, but prioritize meaningful tests
- Keep tests readable and maintainable
- Use descriptive test names that explain what is being tested

## Performance

- Profile before optimizing - measure, don't guess
- Avoid premature optimization
- Use appropriate data structures and algorithms
- Consider database query performance (indexes, N+1 queries)
- Implement pagination for large datasets
- Cache appropriately, but be aware of cache invalidation complexity

## Documentation

- Write self-documenting code with clear naming
- Add comments for complex business logic or non-obvious decisions
- Document public APIs and interfaces
- Keep README files up to date
- Document architectural decisions and trade-offs

## Git & Version Control

- Write clear, descriptive commit messages
- Make atomic commits that represent logical changes
- Don't commit commented-out code or debug statements
- Keep commits focused on a single change
- Use meaningful branch names

## Code Review Mindset

- Review your own code before submitting
- Consider: Is this code maintainable? Is it secure? Is it performant?
- Would a junior developer understand this code?
- Are there any edge cases I'm missing?
- Is this the simplest solution that works?

## Dependencies

- Prefer well-maintained, popular libraries over custom solutions
- Keep dependencies minimal - only add what you need
- Regularly update dependencies for security patches
- Understand what dependencies you're adding and their licenses

## React/TypeScript Frontend Specific

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use proper TypeScript types for props and state
- Avoid unnecessary re-renders (use React.memo, useMemo, useCallback appropriately)
- Handle loading and error states explicitly
- Use proper key props for lists

## Node.js/Express Backend Specific

- Use middleware appropriately for cross-cutting concerns
- Implement proper logging (use structured logging)
- Handle CORS properly
- Implement rate limiting for public APIs
- Use proper status codes (200, 201, 400, 401, 403, 404, 500, etc.)
- Validate request bodies and query parameters
- Implement proper error handling middleware

## When Writing Code

1. **Think first**: Understand the problem before writing code
2. **Plan**: Consider the architecture and design before implementation
3. **Implement**: Write clean, maintainable code
4. **Review**: Check your work for bugs, edge cases, and improvements
5. **Test**: Verify your code works as expected
6. **Refactor**: Improve code quality while maintaining functionality

## Communication

- When suggesting changes, explain the "why" not just the "what"
- If you're unsure about requirements, ask clarifying questions
- Provide context for your decisions
- Consider alternative approaches and trade-offs

Remember: Good code is not just code that works - it's code that works, is maintainable, secure, performant, and understandable by others.

