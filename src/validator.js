const { Util } = require('squirrel_util')

module.exports = class Validator {
  
  constructor(data, rules, message) {
    this.failed = false
    this.failedFields = {}

    this.data = data
    this.rules = rules
    this.message = message

    this.errors = {
      messages: [],
      fields: {}
    }
  }

  // getMessage(field, rule) {
  //   let rulemessage = {};
  //   if (this.isObject(this.message) && this.isObject(this.message[field]))
  //     rulemessage = this.message[field];
  //   let message = '';

  //   switch (rule) {
  //     case 'required':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is required`; break;
  //     case 'array':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not array`; break;
  //     case 'object':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not object`; break;
  //     case 'interger':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not interger`; break;
  //     case 'string':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not string`; break;
  //     case 'datetime':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not datetime`; break;
  //     case 'date':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not date`; break;
  //     case 'time':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not time`; break;
  //     case 'email':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not email`; break;
  //     case 'boolean':
  //       message = Util.info(rulemessage[rule]).isString() ? rulemessage[rule] : `field '${field}' is not boolean`; break;
  //   }

  //   if (/min\:/g.test(rule) || /max\:/g.test(rule)) message = `field '${field}' error ${rule}`;

  //   return message;
  // }

  // subRulesStructure(value) {
  //   if (Util.info(value).isNullOrUndefined()) return false
  //   if (!Util.info(value).isArray()) return false
  //   let [ type, rules ] = value

  //   if (!Util.info(type).isString()) return false
  //   if (!Util.info(rules).isObject()) return false
  //   return true;
  // }

  // dataSubTree(value) {
  //   if (!Util.info(value).isObject()) return false
  //   return true
  // }

  resultError() {
    return { code: 400, message: 'bad request', result: { error: this.errors } }
  }

  fails() {
    return this.failed
  }

  _regexp(rule, value, comparison) {
    let info = Util.info(rule)
    let number = info.getNumber() || info.getFloat()

    try {
      return eval(`${value} ${comparison} ${number}`)
    } catch (error) { return false }
  }

  validate(value, rule, field) {
    let result = {
      failed: true,
      rule: rule,
      field: field
    }

    switch (rule) {
      case 'required':
        result.failed = Util.info(value).isNullOrUndefined()
        break
      case 'boolean':
        result.failed = !Util.info(value).isBoolean()
        break
      case 'string':
        result.failed = !Util.info(value).isString()
        break
      case 'integer':
        result.failed = !Util.info(value).isNumber()
        break
      case 'date':
        result.failed = !Util.info(value).isDate()
        break
    }

    try {
      if (/min\:/g.test(rule)) {
        result.failed = !this._regexp(rule, value, '>=')
      } else if (/max\:/g.test(rule)) {
        result.failed = !this._regexp(rule, value, '<=')
      }
    } catch (error) { }

    return result
  }

  getMessage(rule) {
    switch (rule) {
      case 'required':
        return 'value is required'
      case 'string':
        return 'value is not string'
      case 'integer':
        return 'value is not integer'
      case 'boolean':
        return 'value is not boolean'
      case 'array':
        return 'value is not array'
      case 'object':
        return 'value is not object'
    }

    if (/min\:/g.test(rule)) return `value does not exceed, ${rule}`
    if (/min\:/g.test(rule)) return `value exceeds, ${rule}`

    return 'invalid value'
  }

  setMessage(rule, field) {
    let message = this.message

    if (!field) {
      this.errors.messages.push(this.getMessage(rule))
      return
    }

    message = message || {}
    message = message[field]

    message = Util.info(message).isString() ? message: undefined

    this.errors.fields[field] = (message) ? message: this.getMessage(rule)
    return
  }

  handleArray() {
    if (!Util.info(this.rules).isArray()) throw new Error('Validator handleArray: rules is not array');

    let [required, __rule__] = this.rules

    if (
      Util.info(required).isBoolean() && 
      (Util.info(__rule__).isObject()) || Util.info(__rule__).isArray()
    ) {
      for(let value of (Util.info(this.data).isArray())? this.data : []) {
        this.exec(value, this.rules)
      }
      return this  
    }

    for(let rule of this.rules) {

      if (Util.info(rule).isString()) {
        if (!Util.info(this.data).isArray()) {
          this.setMessage('array')
          continue
        }

        for(let _rule_ of rule.split('|')) {
          if (_rule_ == 'required' && !Util.info(this.data).length()) {
            this.setMessage(_rule_)
            continue
          }

          for(let value of this.data) {
            let result = this.validate(value, _rule_)

            if (result.failed) {
              this.failed = true
              this.setMessage(_rule_, result.field)
            }
          }
        }
      }
    }
    return this
  }

  handleObject() {
    if (!Util.info(this.rules).isObject()) throw new Error('Validator handleObject: rule is not object')

    for(let key in this.rules) {
      let message = this.message
      message = message || {}
      message = message[key]

      if (!Util.info(this.data).isObject()) {
        this.setMessage('object')
        continue
      }

      if (Util.info(this.rules[key]).isString()) {
        for(let rule of this.rules[key].split('|')) {
          let result = this.validate(this.data[key], rule, key)

          if (result.failed) {
            this.failed = result.failed
            this.setMessage(result.rule, result.field)
          }
        }
      } else {
        this.exec(this.data[key], this.rules[key], message, key)
      }
    }

    return this
  }

  exec(data, rule, message, key) {
    if (!Util.info(rule).isArray()) return
    let [required, _rule_] = rule,
        validator = null

    if (required && Util.info(data).isNullOrUndefined()) {
      this.failed = true
      this.setMessage('required', key)
      return
    }

    if (Util.info(_rule_).isObject()) {
      if (!Util.info(data).isObject()) {
        this.failed = true
        this.setMessage('object', key)
        return
      }

      validator = Validator.make(data || {}, _rule_, message)
    }
    else if (Util.info(_rule_).isArray()) {
      if (!Util.info(data).isArray()) {
        this.failed = true
        this.setMessage('array', key)
        return
      }

      validator = Validator.make(data || [], _rule_, message)
    }

    if (validator.fails()) {
      this.failed = true
      this.errors.messages = this.errors.messages.concat(validator.errors.messages)

      if (key)
        this.errors.fields[key] = Object.assign(this.errors.fields[key] || {}, validator.errors.fields)
      else
        this.errors.fields = Object.assign(this.errors.fields || {}, validator.errors.fields)
    }
    return
  }

  handleValue() {
    if (!Util.info(this.rules).isString()) new Error('Validator handleValue: rules is not string')

    for(let rule of this.rules.split('|')) {
      let result = this.validate(this.data, rule)

      if (result.failed) {
        this.failed = true
        this.setMessage(result.rule, result.field)
      }
    }

    return this
  }

  handle() {
    if (Util.info(this.rules).isArray()) {
      return this.handleArray()
    } else if (Util.info(this.rules).isObject()) {
      return this.handleObject()
    } else if (Util.info(this.rules).isString()) {
      return this.handleValue()
    } else throw new Error('Validator handle: value type is not supported, supported types [Array, Object, Date, Boolean, Number, String, Null, Undefined]')
  }

  /**
   * @param {any} data 
   * @param {Array,Object} rules 
   * @param {Array,Object} message 
   * 
   * @returns Validator
   */
  static make(data, rules, message) {
    return (new this(data, rules, message)).handle()
  }
}