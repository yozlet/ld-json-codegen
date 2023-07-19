
import _ from 'underscore.string';
const { camelize, quote, slugify, classify, lines : split_lines } = _;
import { withoutBuiltins, indent, BUILT_INS, isNullOrUndefined, RenderedTemplate } from '../util/helpers.js';

const {hasOwn} = Reflect

export function stringify(value, level = 0) {
    if (Array.isArray(value)) {
        return `[${value.map(v => stringify(v)).join(", ")}]`
    } else if (value instanceof Date) {
        return value.getTime()
    } else if (typeof value == "object" && value !== null) {
       const lines = ['Dictionary(uniqueKeysWithValues: [']
       Object.entries(value).forEach(([key, v]) => {
            lines.push(indent(`(${stringify(key.toString())}, ${stringify(v, level+3)})`, level+2))
       })
       lines.push(indent("])", level+1))
       return lines.join("\n")
    }
    return JSON.stringify(value)
}

export function renderContextBuilder(context) {
    const {key, kind, anonymous, name} = context
    const {privateAttributes} = context._meta || {}
    const customAttributes = withoutBuiltins(context)
    const has = (key) => context.hasOwnProperty(key)
    const lines = [];
    lines.push(`
func create${classify(kind)}Context() -> Result<LDContext, ContextBuilderError> {
    let builder = LDContextBuilder(key: ${stringify(key)})
    builder.kind(${stringify(kind)})
    builder.anonymous(${stringify(!!anonymous)})`);        
    if (!isNullOrUndefined(name)) {
        lines.push(indent(`builder.name(${stringify(name)})`, 2))
    }
    lines.push(indent(split_lines(renderCustomAttributes(customAttributes)).join('\n'), 2));
    (privateAttributes || []).forEach((attr) => {
        lines.push(indent(`builder.addPrivateAttribute(Reference(${stringify(attr)}))`, 2))
    })
    lines.push(indent('return builder.build()', 2))
    lines.push('}')
    const imports = new Set([
        "import LaunchDarkly"
    ])
    return new RenderedTemplate({
        language: "swift",
        fileName: `${classify(kind)}Context.swift`,
        functionName: `create${classify(kind)}Context`,
        content: lines.join("\n"),
        imports
    })
}

function renderCustomAttributes(customAttributes, level=0) {
    const lines = [];
    Object.entries(customAttributes).map(([key, value]) => {
        lines.push(`builder.trySetValue(${stringify(key)}, ${stringify(value, level)})`)

    })
    return lines.join("\n")
}

export function renderMultiContext(contexts) {
    const builders = contexts.map(renderContextBuilder)
    const imports = new Set([
        "com.launchdarkly.sdk.LDContext"
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
        language: "swift",
        fileName: `MultiContextExample.swift`,
        functionName: `createMultiContext`,
        content: lines.join("\n"),
        imports
    })
}


