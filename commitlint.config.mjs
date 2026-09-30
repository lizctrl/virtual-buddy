/**
 * Commit message rules.
 * Format: https://conventionalcommits.org
 *
 * Spec:  <type>(<optional scope>): <description>
 *   feat(api): add register route
 *   fix(auth): compare password with bcryptjs
 */
export default {
    extends: ["@commitlint/config-conventional"],

    rules: {
        // Catches the capitalized `Feat:` seen in older history.
        // Note: array form is [level, when, value] - `when` must be always|never.
        "type-case": [2, "always", "lower-case"],
        "type-enum": [
            2,
            "always",
            [
                "build",
                "chore",
                "ci",
                "docs",
                "feat",
                "fix",
                "perf",
                "refactor",
                "revert",
                "style",
                "test",
            ],
        ],

        // Scopes in this repo are module names: auth, api, schema, dashboard.
        "scope-case": [2, "always", "kebab-case"],

        // Descriptions start lowercase and must not end with a period.
        "subject-case": [2, "never"],
        "subject-full-stop": [2, "never", "."],

        // A subject that can't describe the change is not a commit message.
        "subject-min-length": [2, "always", 10],
        "header-max-length": [2, "always", 72],

        // Reject filler bodies.
        "body-leading-blank": [2, "always"],
    },
};
