/**
 * Created by IvanP on 04.07.2016.
 */

import HierarchyParser from './HierarchyParser.js';
import FixedHeader from './FixedHeader.js';
import SortTable from './SortTable.js';

class AggregatedHierarchyTable{
  /**
   * A class that unifies work with Aggregated tables. Enabling a fixed header, search functionality, sorting, hierarchy etc can be done here.
   * @param {HTMLTableElement} table - table on which the action is to be performed
   * @param {Object} hierarchy - config for {@link HierarchyTable}. See {@link HierarchyTable} docs for available object properties. If hierarchy.source is not defined, it will automatically receive value from `table`
   * @param {Object} fixedHeader - config for {@link FixedHeader}. See {@link FixedHeader} docs for available object properties. If fixedHeader.source is not defined, it will automatically receive value from `table`
   * @param {Object} sorting - config for {@link SortTable}. See {@link SortTable} docs for available object properties. If sorting.source is not defined, it will automatically receive value from `table`. If sorting.data is not explicitly defined, it will automatically receive value from `hierarchy.data`
   * */
  constructor({table, hierarchy, fixedHeader,sorting}={}){
    this.hierarchy=this.sorting=null;
    this.source=table;
    if(hierarchy && typeof hierarchy == 'object'){
      // initialize hierarchy column to be parsed and presented as tree
      hierarchy.source = hierarchy.source||table;
      this.hierarchy = new HierarchyParser(hierarchy);
      this.data = this.hierarchy.data;
      //initialize buttons that will toggle between flat and tree view
      let buttonHost = this.hierarchy.source.querySelector('.reportal-hierarchical-header');
      this.addToggleButton(buttonHost,'hierarchy-tree',false,'Tree View');
      this.addToggleButton(buttonHost,'hierarchy-flat',true,'Flat View');
      if(this.hierarchy.search.enabled){
        this.addSearchBox(buttonHost);
      }
    }

    if(fixedHeader && typeof fixedHeader == 'object'){
      fixedHeader.source = fixedHeader.source||table;
      this.fixedHeader = new FixedHeader(fixedHeader);
      //initialize buttons that will toggle between flat and tree view in the original table
      let buttonHost = this.fixedHeader.clonedHeader.querySelector('.reportal-hierarchical-header');
      [].slice.call(buttonHost.children).forEach((item)=>{item.parentNode.removeChild(item)}); //clears hierarchy toggle buttons cloned from original header
      this.addToggleButton(buttonHost,'hierarchy-tree',false,'Tree View');
      this.addToggleButton(buttonHost,'hierarchy-flat',true,'Flat View');

      if(this.hierarchy.search.enabled){
        this.addSearchBox(buttonHost);
      }
    }
    if(sorting){
      this.source.addEventListener('reportal-table-sort',()=>this.onSort());
      this.sorting = new SortTable({
        enabled:sorting.enabled,
        defaultHeaderRow:sorting.defaultHeaderRow,
        columns: sorting.columns,
        excludedColumns:sorting.excludedColumns,
        defaultSorting:sorting.defaultSorting,
        source:table,
        data:this.data,
        auxHeader: this.fixedHeader.clonedHeader // fixed header
      });
    }

    // for collapsable and sortable hierarchy we want to update cells in the fixed(floating) header.
    var _target;
    var resizeDebouncer = this.constructor.debounce(()=>this.fixedHeader.resizeFixed(),100);
    var scrollDebouncer = this.constructor.debounce(()=>this.scrollToElement(_target),50);
    ['hierarchy-collapsed','hierarchy-uncollapsed','hierarchy-tree-view','hierarchy-flat-view','sort'].forEach((eventNameChunk)=>{
       this.source.addEventListener(`reportal-table-${eventNameChunk}`,(e)=>{
        resizeDebouncer();
        _target = e.target;
        scrollDebouncer();
        if(this.sorting && this.sorting.sortOrder.length>0 && (e.type=='reportal-table-hierarchy-tree-view'||e.type=='reportal-table-hierarchy-flat-view')){
          setTimeout(()=>{this.sorting.sort()},0);
        }
      });
    });
    this.focusFollows(); // for search field to setup following focus
  }


  /**
   * Allows focus to follow from a search field into floating header and back when header disappears.
   * */
  focusFollows(){
    if(this.fixedHeader){
      var inputs = [].slice.call(this.source.parentNode.querySelectorAll('.reportal-hierarchical-header input'));
      ['visible','hidden'].forEach(eventChunk=>{
        this.source.addEventListener(`reportal-fixed-header-${eventChunk}`,(e)=>{
          if(this.hierarchy.search.searching && document.activeElement && inputs.indexOf(document.activeElement)!=-1){
            let current = this.hierarchy.search.target;
            for(let i=0;i<inputs.length;i++){
              if(inputs[i]!=document.activeElement){
                inputs[i].focus();
                this.hierarchy.search.target=inputs[i];
                break;
              }
            }
          }
        })
      });
    }
  }

  /**
   * Method evoked when sorting happened. If mode is hierarchical, we want to perform hierarchical row reordering in the array before appending changes to the table. After array is ready, table rows are reordered.
   * */
  onSort(){
    if(!this.hierarchy.flat){ // we want to perform hierarchical row reordering in the array before appending changes to the table
      this.data.forEach((block,index)=>{
        let dataLevels = this.constructor.spliceLevel(block),
            sortedData=[];
          dataLevels[0].forEach(row=>{
            sortedData.push(row);
            this.reorderSorted(dataLevels,row,sortedData);
          });
      console.log(this.data);
          this.data[index] = sortedData;
      });
    }
    this.hierarchy.reorderRows(this.data);// finally reposition sorted rows
  }

  /**
   * Separates a `data` array into arrays dedicated to each level at index of the level
   * @param {Object} dataSource - initial `data`
   * */
  static spliceLevel(dataSource){
    let a = [];
    dataSource.forEach((row,index)=>{
      let lvl = row.meta.level;
      if(!a[lvl]){a[lvl]=[];}
        a[lvl].push(row);
    });
    return a;
  }

  /**
   * Reorders rows in the sorted arrays so that the children rows follow their parent ones
   * @param {Object} source - source array,
   * @param {Array} row - parent row
   * @param {Array} output - an array the rows will be appended which is a result array
   * */
  reorderSorted(source,row,output,insertAtIndex=output.length){
      if(row.meta.hasChildren){
        let parent = row.meta.parent,
            childLevel = source[row.meta.level+1],
            childLevelLength = childLevel.length;
        while(childLevelLength--){
          if(childLevel[childLevelLength].meta.parent.meta.row==row.meta.row){
            //since we go backwards (to reduce array for the next iteration), we'll always want to add the row at `output.length`,
            // which technically is right after the parent insertion point
            output.splice(insertAtIndex,0,childLevel[childLevelLength]);
            if(childLevel[childLevelLength].meta.hasChildren){
              this.reorderSorted(source,childLevel[childLevelLength],output,insertAtIndex+1);
            }
            childLevel.splice(childLevelLength,1);
          }
        }
      }
  }

  /**
   * This function adds toggle buttons for hierarchy (to toggle the [flat-view/tree-view]{@link HierarchyTable#flat} mode) to the hierarchy column (here available as `this.hierarchy.column`).
   * This function is executed for both the original table and the cloned header.
   * @param {HTMLTableCellElement} host - reference to the cell which acts as a header for hierarchy column
   * @param {String} buttonClassChunk - the part of the icon-class name that follows the `.icon-`. Is used to reference the icon class, but also used for the button without the `.icon-` prefix
   * @param {Boolean} flat - Boolean to be set on [`hierarchy.flat`]{@link HierarchyTable#flat} when this button is clicked.
   * @param {String} [title] - the title that describes what the button does to be show on hover (is set to native attribute `title` on the button element)
   * */
  addToggleButton(host,buttonClassChunk,flat,title){
    let button = document.createElement('span'),
        buttonContainer = document.createElement('span');
    button.classList.add(`icon-${buttonClassChunk}`);
    buttonContainer.classList.add('btn', buttonClassChunk);
    buttonContainer.title=title;
    if(flat==this.hierarchy.flat){buttonContainer.classList.add('active');}
    buttonContainer.addEventListener('click',(e)=>{
      if(flat==this.hierarchy.flat){return;} else {
        this.hierarchy.flat = flat;
        // we want to get all hier. toggle buttons in both cloned header and the table itself
        let hierColumnButtons = this.hierarchy.source.parentNode.querySelectorAll('.reportal-hierarchical-header>.btn:not(.hierarchy-search)');
        if(hierColumnButtons){[].slice.call(hierColumnButtons).forEach((item)=>{
          //By default one button is already `.active`, we need just to swap the `.active` class on them
          !item.classList.contains('active')?item.classList.add('active'):item.classList.remove('active');
        })}
      }
    });
    buttonContainer.appendChild(button);
    host.appendChild(buttonContainer);
  }

  /**
   * Adds a search icon and a search box to the header of the hierarchy column (`host`)
   * @param {HTMLTableCellElement} host - header of the hierarchy column
   * */
  addSearchBox(host){
    let button = document.createElement('span'),
        buttonContainer = document.createElement('span'),
        clearButton = document.createElement('span'),
        searchfield = document.createElement('input');

    searchfield.type='text';
    button.classList.add('icon-search');
    clearButton.classList.add('icon-add', 'clear-button');
    buttonContainer.classList.add('btn', 'hierarchy-search');

    //listener to display search field on search-icon click
    button.addEventListener('click',e=>{
      if(!this.hierarchy.search.visible){this.hierarchy.search.visible = true;}
      e.target.parentNode.querySelector('input').focus();
    });

    //listener to display search field on search-icon click
    clearButton.addEventListener('click',e=>{
      this.clearSearch();
    });

    buttonContainer.title = searchfield.placeholder = 'Search categories...';

    let efficientSearch = this.search();
    //TODO: add cursor following the header (if a floating header appeared, cursor must focus there)
    searchfield.addEventListener('keyup',e=>{
      this.updateSearchTarget(e); //update search parameters
      efficientSearch();          // call search less frequently
    });

    searchfield.addEventListener('blur',e=>{
      if(e.target.value.length==0)this.clearSearch(); //update search parameters
  });

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(searchfield);
    buttonContainer.appendChild(clearButton);
    host.appendChild(buttonContainer);
  }

  /**
   * Nulls search and redoes it, used in toggling between `flat` and `tree` views in hierarchy, necessary because the search is done on different name strings
   * */
  clearSearch(){
    this.hierarchy.search.target = null;
    this.hierarchy.search.query='';
    this.hierarchy.search.visible=false;
    this.hierarchy.search.searching=false;
    var inputs = this.hierarchy.source.parentNode.querySelectorAll('.reportal-hierarchical-header input');
    if(inputs && inputs.length>1){inputs.forEach(input=>{input.value = '';})}
  }

  /**
   * Updates `search.target` && `search.query` in `hierarchy.search` to know which input triggered the search and update the `search.query` in the other
   * @param {Event} e - a debounced event triggered by input field when a person enters text
   * */
  updateSearchTarget(e){
    this.hierarchy.search.target = e.target;
    this.hierarchy.search.query = e.target.value;
    var inputs = this.hierarchy.source.parentNode.querySelectorAll('.reportal-hierarchical-header input');
    if(inputs && inputs.length>1){inputs.forEach(input=>{if(input!=e.target){input.value = e.target.value;return;}})}
  }

  /**
   * Smooth-scrolls page so that the element that's been clicked stays ato the top of the table and compensates for scrolling header.
   * There is a flaw that the collapsed/uncollapsed event is triggered for all searching, so a debouncer is set in place, though it does scroll to the last expanded found element
   * @param {HTMLElement} el - element that triggered the event
   * */
  scrollToElement(el){
    let visible = window.pageYOffset>this.source.parentNode.offsetTop;
    var floatingHeader = visible?this.fixedHeader.clonedHeader.offsetHeight:0,
          offset = this.source.parentNode.offsetTop + el.offsetTop - floatingHeader;
          this.scrollTo(offset,200);

      window.setTimeout(()=>{
      if(visible!=window.pageYOffset>this.source.parentNode.offsetTop){
          this.scrollTo(this.source.parentNode.offsetTop + el.offsetTop - (window.pageYOffset>this.source.parentNode.offsetTop?this.fixedHeader.clonedHeader.offsetHeight:0),20)
      }
    },250);

  }

  /**
   * Implements smooth srolling
   * @param {Number} to - offset from top of the page the window needs to be scrolled to
   * @param {Number} duration - auxiliary parameter to specify scroll duration and implement easing
   * */
  scrollTo(to, duration) {
  var start = window.pageYOffset || document.documentElement.scrollTop,
    change = to - start,
    currentTime = 0,
    increment = 20;

  var animateScroll = function(){
    currentTime += increment;
    var val = easeInOutQuad(currentTime, start, change, duration);
    window.scrollTo(0,val);
    if(currentTime < duration) {
      setTimeout(animateScroll, increment);
    }
  };
  animateScroll();

  //t = current time
  //b = start value
  //c = change in value
  //d = duration
    function easeInOutQuad (t, b, c, d) {
      t /= d/2;
      if (t < 1) return c/2*t*t + b;
      t--;
      return -c/2 * (t*(t-2) - 1) + b;
    }
}


  /**
   * Wrapping function that debounces search, sets `search.searching` [(click for info)]{@link HierarchyTable#setupSearch} and calls `hierarchy.searchRowheaders` [(click for info)]{@link HierarchyTable#searchRowheaders}
   * @return {Function}
   * */
  search(){
    let hierarchy = this.hierarchy,
        settings = hierarchy.search,
        self=this;
    return this.constructor.debounce(function(){
      let value = settings.query;
      if(value.length>0){
        if(!settings.searching){settings.searching=true;}
        hierarchy.searchRowheaders(value);
      } else {
        settings.searching=false;
      }
    }, settings.timeout, settings.immediate);

  }

  /**
   * A debouncing function, used for cases when as `func` function needs to be called less often, after a certain `wait` timeout or `immediate`-ly
   * @param {Function} func - the function that needs to be executed at a lesser rate
   * @param {Number} [wait=300] - timeout after which the `func`tion executes
   * @param {Boolean} [immediate=false] - flag to be set when function needs to be executed immediately (overrides `wait` timeout)
   * @return {Function}
   * */
  static debounce (func, wait=300, immediate=false){
    var timeout;
    return ()=>{
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }


}

export default AggregatedHierarchyTable;
