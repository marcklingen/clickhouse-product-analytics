import type { AutocaptureConfig, CaptureProperties } from './types.js'

const COMPATIBLE_ELEMENTS = ['a', 'button', 'form', 'input', 'select', 'textarea', 'label']
const SENSITIVE_NAME_RE = /^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i
const CREDIT_CARD_RE = /^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/
const SSN_RE = /^(\d{3}-?\d{2}-?\d{4})$/

export function shouldAutocapture(element: Element, event: Event, config: AutocaptureConfig): boolean {
  if (!shouldCaptureElement(element)) {
    return false
  }
  if (config.urlAllowlist && !matchesUrl(config.urlAllowlist)) {
    return false
  }
  if (config.urlIgnorelist && matchesUrl(config.urlIgnorelist)) {
    return false
  }
  if (config.domEventAllowlist && !config.domEventAllowlist.includes(event.type as 'click')) {
    return false
  }
  const tree = elementAndParents(element)
  if (config.elementAllowlist && !tree.some((item) => config.elementAllowlist!.includes(item.tagName.toLowerCase()))) {
    return false
  }
  if (config.cssSelectorAllowlist?.length && !tree.some((item) => config.cssSelectorAllowlist!.some((selector) => item.matches(selector)))) {
    return false
  }

  const tag = element.tagName.toLowerCase()
  if (tag === 'form') {
    return event.type === 'submit'
  }
  if (['input', 'select', 'textarea'].includes(tag)) {
    return event.type === 'change' || event.type === 'click'
  }
  return event.type === 'click' && (COMPATIBLE_ELEMENTS.includes(tag) || tree.some((item) => COMPATIBLE_ELEMENTS.includes(item.tagName.toLowerCase())))
}

export function autocaptureProperties(element: Element, event: Event, config: AutocaptureConfig): CaptureProperties {
  const sensitive = isSensitiveElement(element)
  const text = !sensitive && config.captureText ? safeText(element) : undefined
  return {
    '$event_type': event.type,
    '$el_tag_name': element.tagName.toLowerCase(),
    '$el_text': text,
    '$el_id': element.id || undefined,
    '$el_classes': typeof element.className === 'string' ? element.className : undefined,
    '$elements_chain': elementAndParents(element)
      .slice(0, 5)
      .map((item) => elementDescriptor(item))
      .join(' > ')
  }
}

export function eventTarget(event: Event): Element | null {
  const target = event.target
  if (!target) {
    return null
  }
  if (target instanceof Element) {
    return target.shadowRoot && event.composedPath ? event.composedPath()[0] as Element : target
  }
  return null
}

function shouldCaptureElement(element: Element): boolean {
  for (const current of elementAndParents(element)) {
    const classes = classNames(current)
    if (classes.includes('cpa-sensitive') || classes.includes('cpa-no-capture')) {
      return false
    }
  }

  if (classNames(element).includes('cpa-include')) {
    return true
  }

  const input = element as HTMLInputElement
  const type = typeof input.type === 'string' ? input.type.toLowerCase() : ''
  if (type === 'hidden' || type === 'password') {
    return false
  }

  const name = typeof input.name === 'string' ? input.name : ''
  const id = typeof input.id === 'string' ? input.id : ''
  if (SENSITIVE_NAME_RE.test(`${name}${id}`.replace(/[^a-zA-Z0-9]/g, ''))) {
    return false
  }

  const value = typeof input.value === 'string' ? input.value.trim().replace(/[- ]/g, '') : ''
  if (value && (CREDIT_CARD_RE.test(value) || SSN_RE.test(input.value.trim()))) {
    return false
  }

  return true
}

function isSensitiveElement(element: Element): boolean {
  const input = element as HTMLInputElement
  const allowedInputTypes = ['button', 'checkbox', 'submit', 'reset']
  return (
    (element.tagName.toLowerCase() === 'input' && !allowedInputTypes.includes((input.type || '').toLowerCase())) ||
    ['select', 'textarea'].includes(element.tagName.toLowerCase()) ||
    element.getAttribute('contenteditable') === 'true'
  )
}

function safeText(element: Element): string | undefined {
  const text = directText(element).replace(/\s+/g, ' ').trim()
  if (!text) {
    return undefined
  }
  if (CREDIT_CARD_RE.test(text.replace(/[- ]/g, '')) || SSN_RE.test(text)) {
    return undefined
  }
  return text.slice(0, 256)
}

function directText(element: Element): string {
  const values: string[] = []
  const view = element.ownerDocument?.defaultView
  const textNodeType = view?.Node.TEXT_NODE ?? 3
  const SpanElement = view?.HTMLSpanElement
  element.childNodes.forEach((node) => {
    if (node.nodeType === textNodeType && node.textContent) {
      values.push(node.textContent)
    }
    if (SpanElement && node instanceof SpanElement && node.childNodes.length === 1 && node.firstChild?.nodeType === textNodeType) {
      values.push(node.textContent ?? '')
    }
  })
  return values.join(' ')
}

function elementAndParents(element: Element): Element[] {
  const elements: Element[] = []
  for (let current: Element | null = element; current && current.tagName.toLowerCase() !== 'body'; current = current.parentElement) {
    elements.push(current)
  }
  return elements
}

function elementDescriptor(element: Element): string {
  const id = element.id ? `#${element.id}` : ''
  const classes = classNames(element).slice(0, 3).map((name) => `.${name}`).join('')
  return `${element.tagName.toLowerCase()}${id}${classes}`
}

function classNames(element: Element): string[] {
  return typeof element.className === 'string'
    ? element.className.split(/\s+/).filter(Boolean)
    : []
}

function matchesUrl(matchers: Array<string | RegExp>): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const href = window.location.href
  return matchers.some((matcher) => typeof matcher === 'string' ? href.includes(matcher) : matcher.test(href))
}
