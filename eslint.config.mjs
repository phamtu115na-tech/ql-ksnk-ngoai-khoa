import parser from '@typescript-eslint/parser'
export default [
 {ignores:['.next/**','node_modules/**','legacy-apps-script/**','patches/**']},
 {files:['app/**/*.{ts,tsx}','lib/**/*.ts'],languageOptions:{parser},rules:{'no-debugger':'error','no-dupe-else-if':'warn','no-unreachable':'warn'}}
]
