/**
 * Created by IvanP on 10.06.2016.
 */

class ReportalBase {

  /**
   * Copies props from a source object to a target object.
   *
   * Note, this method uses a simple `for...in` strategy for enumerating
   * properties.  To ensure only `ownProperties` are copied from source
   * to target and that accessor implementations are copied, use `extend`.
   *
   * @method mixin
   * @param {Object} target Target object to copy properties to.
   * @param {Object} source Source object to copy properties from.
   * @return {Object} Target object that was passed as first argument.
   */
  static mixin(target, source) {
    for (var i in source) {
      target[i] = source[i];
    }
    return target;
  }

  static _logger(level, args) {
    // accept ['foo', 'bar'] and [['foo', 'bar']]
    if (args.length === 1 && Array.isArray(args[0])) {
      args = args[0];
    }
    // only accept logging functions
    switch(level) {
      case 'log':
      case 'warn':
      case 'error':
        console[level].apply(console, args);
        break;
    }
  }

  static _log() {
    var args = Array.prototype.slice.call(arguments, 0);
    this._logger('log', args);
  }

  static _warn() {
    var args = Array.prototype.slice.call(arguments, 0);
    this._logger('warn', args);
  }

  static _error() {
    var args = Array.prototype.slice.call(arguments, 0);
    this._logger('error', args);
  }

  /**
   * Creates a named event with `name`
   * @param {String} name - name of the event
   * @return {Event} Returns a created event
   * */
  static newEvent(name){
    var event = document.createEvent('Event');
    event.initEvent(name, true, true);
    return event;
  }

  /**
   * Inspects if the current string might be converted to number and renders it as number. If string length is 0, returns `null`. If none applies returns the string as is.
   * @param {String} str - value of the cell if not HTML contents
   * @return {Number|null|String}
   * */
  static _isNumber(str){
    if(!isNaN(parseFloat(str))){
      str = str.replace(/,/i,'');// remove unnecessary comma as a delimiter for thousands from data.
      return parseFloat(str);
    } else if(str.length==0){return null} else {return str}
  }


  /**
   * Creates an XHR wrapped in a Promise
   * @param {!String} URL - url to send a `GET` request to
   * @return {Promise} Returns a then-able promise with `XMLHttpRequest.responseText`
   * */
  promiseRequest(URL){
    return new Promise((resolve,reject)=>{
        let xhr = new XMLHttpRequest();
    xhr.open('GET', URL, true);
    xhr.onload = ()=>{xhr.status == 200?resolve(xhr.responseText):reject(Error(`${xhr.status}: ${xhr.statusText}`));}
    xhr.onerror = ()=>{reject(Error("Network Error"));}
    xhr.send();
  });
  }

  /**
   * Gets a variable listed in query string
   * @param {!String} variable - variable name to get value for
   * @param {String=} [query=window.location.search.substring(1)] - the query string to search variable for in
   * @return {String} Returns value for the variable
   * */
  static getQueryVariable(variable,query=window.location.search.substring(1)){
    var query = query;
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=");
      if((pair[0]).toLowerCase() == variable.toLowerCase()){return pair[1];}
    }
    return(false);
  }



}
export default ReportalBase
