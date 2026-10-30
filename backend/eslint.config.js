module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly", module: "writable", process: "readonly",
        console: "readonly", setTimeout: "readonly",
        describe: "readonly", test: "readonly", expect: "readonly",
        jest: "readonly", beforeEach: "readonly"
      }
    },
    rules: { "no-undef": "error", "no-unused-vars": "warn" }
  }
];
