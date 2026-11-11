import js from "@eslint/js"
import globals from "globals"

export default [
    { ignores: ["node_modules/**", "artifacts/**"] },
    js.configs.recommended,
    {
        files: ["**/*.cjs", "**/*.mjs", "**/*.js"],
        languageOptions: { globals: globals.node },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
            "no-restricted-syntax": [
                "error",
                { selector: "ChainExpression", message: "请勿使用可选链。" },
                { selector: "LogicalExpression[operator='??']", message: "请勿使用空值合并。" }
            ]
        }
    }
]
