
import _ from 'underscore.string';
const { camelize, quote, slugify, classify } = _;
import { withoutBuiltins, indent, BUILT_INS, isNullOrUndefined, RenderedTemplate } from '../util/helpers.js';
const {stringify} = JSON;
const {hasOwn} = Reflect

export function kstringify(value, level = 0) {
    if (Array.isArray(value)) {
        const lines = ['LDValue.buildArray()']
        value.forEach((v) => {
             lines.push(indent(`.add(${kstringify(v, level+3)})`, level + 1))
        });
        lines.push(indent(".build()", level+1))
        return lines.join("\n")
    } else if (value instanceof Date) {
        return value.getTime()
    } else if (typeof value == "object" && value !== null) {
       const lines = ['LDValue.buildObject()']
       Object.entries(value).forEach(([key, v]) => {
            lines.push(indent(`.put(${kstringify(key.toString())}, ${kstringify(v, level+3)})`, level+2))
       })
       lines.push(indent(".build()", level+1))
       return lines.join("\n")
    } else if (typeof value == "number" && !isNaN(value)) {
        return `${stringify(value)}d`
    }
    return stringify(value)
}

export function renderContextBuilder(context) {
    const {key, kind, anonymous, name} = context
    const {privateAttributes} = context._meta || {}
    const customAttributes = withoutBuiltins(context)
    console.log(customAttributes)
    const has = (key) => context.hasOwnProperty(key)
    const lines = [];
    const hasPrivateAttributes = privateAttributes && privateAttributes.length > 0;
    lines.push(`
class ${classify(kind)}ContextBuilder {
    public static LDContext createContext() {
        return LDContext.builder(ContextKind.of(${stringify(kind)}), ${stringify(key)})
            .anonymous(${stringify(!!anonymous)})`)

    if (!isNullOrUndefined(name)) {
        lines.push(indent(`.name(${stringify(name)})`, 6))
    }
    lines.push(indent(renderCustomAttributes(customAttributes, 0, false), 6))
    if(hasPrivateAttributes) {
        lines.push(indent(`.privateAttributes(${privateAttributes.map(stringify).join(", ")})`, 6))
    }
    lines.push(indent('.build();', 6))
    lines.push(indent('}', 2))
    lines.push('}')
    const imports = new Set([
        "import com.launchdarkly.sdk.LDValue;",
        "import com.launchdarkly.sdk.LDContext;",
        "import com.launchdarkly.sdk.ObjectBuilder;",
        "import com.launchdarkly.sdk.ArrayBuilder;",
        "import com.launchdarkly.sdk.ContextKind;",
    ])
    return new RenderedTemplate({
        language: "java",
        fileName: `${classify(kind)}Context.java`,
        functionName: `create${classify(kind)}Context`,
        content: lines.join("\n"),
        imports
    })
}

function renderCustomAttributes(customAttributes, level=0, includeSemicolon = false) {
    const lines = [];
    Object.entries(customAttributes).map(([key, value]) => {
        lines.push(`.set(${stringify(key)}, ${kstringify(value, level)})`)

    })
    return lines.join("\n")
}

export function renderMultiContext(contexts) {
    const builders = contexts.map(renderContextBuilder)
    const imports = new Set([
        "import com.launchdarkly.sdk.LDContext;"
    ]);
    
    const lines = []
    lines.push(
`
func createMultiContext() -> LDContext {
    // Or LDContext.createMulti(LDContext...)
    return LDContext.multiBuilder()
`)
    builders.forEach(builder => {
        lines.push(indent(`.add(${builder.functionName}())`, 1))
    })
    lines.push(indent('.build()', 1))
    lines.push('}')
    return new RenderedTemplate({
        language: "kotlin",
        fileName: `MultiContextExample.kt`,
        functionName: `createMultiContext`,
        content: lines.join("\n"),
        imports
    })
}


