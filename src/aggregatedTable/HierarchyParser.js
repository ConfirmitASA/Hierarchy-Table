import Highlight from '../lib/Highlight.js';

class HierarchyParser{
  /**
   * Converts flat view rowheaders into a tree-view rowheaders with ability to switch between views.
   * After hierarchy is initialized, `HierarchyTable.data` array will reflect the rows of the table in their visible order and contain `meta` for each row in the array.
   * When a row is collapsed, a `reportal-table-hierarchy-collapsed` Event is fired.
   * When a row is uncollapsed, a `reportal-table-hierarchy-uncollapsed` Event is fired.
   * When a row is switched to flat-view, a `reportal-table-hierarchy-flat-view` Event is fired.
   * When a row is switched to tree-view, a `reportal-table-hierarchy-tree-view` Event is fired.
   * @param {HTMLTableElement} source - source table that needs a cloned header
   * @param {Array} hierarchy - array of hierarchy objects from Reportal
   * @param {Number} [column=0] - index of column in the table that contains hierarchy (increments from `0`)
   * @param {Boolean} [flat=false] - Should hierarchy be rendered flatly(`true`), or in a tree-fashion (`false`).
   *
   * @param {Object} search - config for searching functionality. See {@link HierarchyTable#setupSearch}
   * @param {Boolean} search.enabled=false - flag to be set when enabling the search
   * @param {Boolean} search.immediate=false - flag to be set for serach to happen after each stroke rather than by `timeout`
   * @param {Number} search.timeout=300 - minimal time(in milliseconds) after last keystroke when searching takes place
   * @param {Boolean} [search.searching=false] - this property is mostly for internal use and is set when searching is in progress, which adds a class to the table hiding all rows not matching search
   * @param {String} [search.query=''] - search string
   * @param {HTMLInputElement} search.target - the input element that triggered the search.
   *
   * @param {Array} [data=[]] - array with data if it's passed from outside, rather than acquired from the `source` (HTML table)
   * @param {Array} [blocks=[]] - array with block ids that split hierarchies
   * */
  constructor({source,hierarchy,column = 0,flat = false,search={},data=[],blocks=[]} = {}){
    this.source = source;
    this.hierarchy = hierarchy.rowheaders;
    this.column = column;
    this.blocks = blocks;
    this._rows = source.parentNode.querySelectorAll(`table#${source.id}>tbody>tr`);
    this._collapseEvent = this.constructor.newEvent('reportal-table-hierarchy-collapsed');
    this._uncollapseEvent = this.constructor.newEvent('reportal-table-hierarchy-uncollapsed');
    this._flatEvent = this.constructor.newEvent('reportal-table-hierarchy-flat-view');
    this._treeEvent = this.constructor.newEvent('reportal-table-hierarchy-tree-view');
    this.data = this.setUpBlocks(data,blocks);
    console.log(this.data);
    this.flat = flat;
    this.search = this.setupSearch(search);
    this.__lastEffectiveParent = null;// we'll store row of parent when doing search for effectiveness of children recursion in `searchRowheaders`
    this.init();
  }

  /**
   * Initializes the hierarchical structure for a table by creating new set of table rows with correct order and additional information in attributes
   * */
  init(){
    let tbody = this.source.querySelector("tbody");
    this.source.querySelector(`thead>tr>td:nth-child(${this.blocks.length>0?this.column:this.column+1})`).classList.add('reportal-hierarchical-header');

    if(tbody.firstChild && tbody.firstChild.nodeType==3){
      tbody.removeChild(tbody.firstChild)
    }
    this.reorderRows(this.data);
  }

  /**
   * This function takes care of repositioning rows in the table to match the `data` array in the way it was sorted and if the data is separated into blocks, then move the block piece to the first row in each data block.
   * */
  reorderRows(data,tbody=this.source.querySelector('tbody')){
    data.forEach(block=>{
      block.forEach((row,index,array)=>{
        if(row.meta.block!=null && index==0 && !row.meta.firstInBlock){ //block is defined and this is the first row in block (and doesn't contain block header already), we need to move block header from whatever line into this row
          let blockContainer = array.find(item=>item.meta.firstInBlock);
          blockContainer.meta.firstInBlock = false;
          row.meta.firstInBlock = true;
          row.meta.row.insertBefore(row.meta.block.cell, row.meta.row.firstChild);
        }
        tbody.appendChild(row.meta.row);
      })
    });
  }

  /**
   * This function initializes a prototype for search functionality for hierarchical column
   * @param {Boolean} enabled=false - flag to be set when enabling the search
   * @param {Boolean} immediate=false - flag to be set for serach to happen after each stroke rather than by `timeout`
   * @param {Number} timeout=300 - minimal time(in milliseconds) after last keystroke when searching takes place
   * @param {Boolean} [searching=false] - this property is mostly for internal use and is set when searching is in progress, which adds a class to the table hiding all rows not matching search
   * @param {String} [query=''] - search string
   * @param {HTMLInputElement} target - the input element that triggered the search.
   * @param {Boolean} [visible=false] - search box is visible
   * @param {Boolean} [highlight=true] - search matches will be highlighted
   * */
  setupSearch({enabled = false, immediate = false, timeout=300, searching=false, query='', target, visible=false,highlight = true}={}){
    var _searching = searching,
      self = this,
      _query = query,
      _visible=visible,
      _highlight = highlight? new Highlight({element:[].slice.call(this.source.querySelectorAll('.reportal-hierarchical-cell')),type:'open'}):null;

    return {
      timeout,
      enabled,
      immediate,
      target,
      highlight:_highlight,
      get query(){return _query},
      set query(val){
        _query = val;
        if(val.length==0 && this.highlight){this.highlight.remove();} // clear highlighting when query length is 0
      },

      get visible(){return _visible},
      set visible(val){
        _visible = val;
        [].slice.call(self.source.parentNode.querySelectorAll('.hierarchy-search')).forEach(button=>{
          if(val){
            button.classList.add('visible');
            button.parentNode.classList.add('hierarchy-search-visible'); //to hide sorting arrow because it overlaps the search field
          }else{
            button.classList.remove('visible');
            button.parentNode.classList.remove('hierarchy-search-visible');
          }
        });
      },

      get searching(){return _searching},
      set searching(val){
          _searching=val;
          val?self.source.classList.add('reportal-hierarchy-searching'):self.source.classList.remove('reportal-hierarchy-searching');
          if(!val){
            self.collapseAll(); // we want to collapse all expanded rows that could be expanded during search
          }
      }
    }
  }

  /**
   * This function builds a prototype for each row
   * @param {HTMLTableRowElement} row - reference to the `<tr>` element
   * @param {String} flatName - default string name ('/'-delimited) for hierarchy
   * @param {String} name - a trimmed version of `flatName` containing label for this item without parent suffices
   * @param {HTMLTableCellElement} nameCell - reference to the `<td>` element that contains the rowheader hierarchical label/name
   * @param {String} block - id of the block the row belongs to
   * @param {Boolean} firstInBlock - whether the row is the first in this block, which meatns it has an extra cell at the beginning
   * @param {String} parent - internal Reportal id of parent row
   * @param {Number} level - level of hierarchy, increments form `0`
   * @param {Boolean} [hidden=true] - flag set to hidden rows (meaning their parent is in collapsed state)
   * @param {Boolean} [collapsed=undefined] - flag only set to rows which have children (`hasChildren=true`)
   * @param {Boolean} [matches=false] - flag set to those rows which match `search.query`
   * @param {Boolean} [hasChildren=false] - flag set to rows which contain children
   * @param {Array} children=[] - child rows if `hasChildren == true`
   * */
  setupMeta({row, flatName, name, nameCell, block, firstInBlock, parent, level, hidden=true, collapsed, matches=false, hasChildren=false, children=[]}={}){
    let _hidden = hidden, _collapsed = collapsed, _hasChildren=hasChildren, _matches = matches, self=this;
    return {
      row,
      nameCell,
      flatName,
      name,
      block,
      firstInBlock,
      parent,
      children,
      level,
      get hasChildren(){return _hasChildren},
      set hasChildren(val){
        _hasChildren = val;
        if(typeof val!=undefined && !val){
          this.row.classList.add('reportal-no-children');
        }
      },
      get hidden(){return _hidden},
      set hidden(val){
        _hidden=val;
        val?this.row.classList.add("reportal-hidden-row"):this.row.classList.remove("reportal-hidden-row");
      },
      get collapsed(){return _collapsed},
      set collapsed(val){
        if(typeof val != undefined && this.hasChildren){
          _collapsed=val;
          if(val){
            this.row.classList.add("reportal-collapsed-row");
            this.row.classList.remove("reportal-uncollapsed-row");
            self.toggleHiddenRows(this);
            this.row.dispatchEvent(self._collapseEvent);
          } else {
            this.row.classList.add("reportal-uncollapsed-row");
            this.row.classList.remove("reportal-collapsed-row");
            self.toggleHiddenRows(this);
            this.row.dispatchEvent(self._uncollapseEvent);
          }
        }
      },
      get matches(){return _matches},
      set matches(val){
        _matches=val;
        if(val){
          this.row.classList.add("matched-search");
        } else {
          this.row.classList.contains("matched-search")?this.row.classList.remove("matched-search"):null;
          if(this.hasChildren){
            this.collapsed=true;
          }
        }
      }
    };

  }

  /**
   * Sets `this.flat`, adds/removes `.reportal-heirarchy-flat-view` to the table and updates labels for hierarchy column to flat/hierarchical view
   * @param {Boolean} val - value to set on `flat`
   * */
  set flat(val){
    this._flat=val;
    val?this.source.classList.add('reportal-heirarchy-flat-view'):this.source.classList.remove('reportal-heirarchy-flat-view');
    // we want to update labels to match the selected view
    if(this.search && this.search.searching && this.search.highlight){this.search.highlight.remove();} //clear highlighting
    if(this.data){
      this.data.forEach(block=> {
        block.forEach(row=>this.updateCategoryLabel(row))
      });
    }
    //if the search is in progress, we need to model hierarchical/flat search which is basically redoing the search.
    if(this.search && this.search.searching){
      this.search.searching = false; // clears search
      this.search.searching = true; //reinit search
      this.searchRowheaders(this.search.query); //pass the same query
    } else if(this.search && !this.search.searching && !val){
      this.data.forEach(block=>{block.forEach(row=>this.toggleHiddenRows(row.meta))});
    }

    val?this.source.dispatchEvent(this._flatEvent):this.source.dispatchEvent(this._treeEvent)
  }
  /**
   * getter for `flat`
   * @return {Boolean}
   * */
  get flat(){
    return this._flat;
  }

  /**
   * Replaces category label in the array in the hierarchical column position and in the html row through meta. Replacing it in the array is important for sorting by category.
   * @param {Array} row - an item in the `this.data` Array
   * */
  updateCategoryLabel(row){
    let cell = row.meta.nameCell,
      // we want to make sure if there is a link (drill-down content) then we populate the link with new title, else write to the last text node.
      label = cell.querySelector('a')? cell.querySelector('a') : cell.childNodes.item(cell.childNodes.length-1),
      text = this.flat? row.meta.flatName: row.meta.name;
    // update the label in the array. Since we didn't include the block label, we need to offset it by one from the column in all cases.
    row[this.blocks.length>0? this.column-1:this.column] = text;

    // update the label in the table.
    label.nodeType==3? label.nodeValue=text : label.textContent = text;
  }

  /**
   * If `blocks` array is not empty, then we have blocks that rowspan across hierarchy instances. This function creates meta for blocks, and makes them accessible as properties in the array. Then it launches `parseHierarchy` per each block.
   * @param {Array} data - initial data if passed
   * @param {Array} blocks - array of `blocks` passed in constructor
   * */
  setUpBlocks(data,blocks){
    if(data.length>0){return data} //if data was already passed, use it, we assume it's ready prepared
    var arr = [];
    if(blocks && blocks.length>0){
      var tdBlocks = this.source.parentNode.querySelectorAll(`table#${this.source.id}>tbody>tr>td:nth-child(${this.column})[rowspan]`);
      if(tdBlocks.length>0){
        for(let i=0;i<tdBlocks.length;i++){
          let block = blocks[i].toLowerCase();
          arr[block] = {data:[], name:block, cell:tdBlocks[i]};
          arr.push(arr[block].data);
          this.parseHierarchy({array: arr[block].data, block:arr[block]});
        }
      }
    } else {
      arr[0]=[];
      let rows = [].slice.call(this.source.parentNode.querySelectorAll(`table#${this.source.id}>tbody>tr`));
      this.parseHierarchy({array: arr[0], block:null, rows, parent:null});
    }
    return arr;
  }

  /**
   * Recursive function taking rows according to `hierarchy` object, adding information to that row, retrieving data from the row, and adding this array to `this.data`
   * Each item in the array has a `meta {Object}` (See {@link HierarchyTable#setupMeta}) property that has the following structure:
   *
   * ``` javascript
   * {
   *    collapsed: Boolean, // if true, the row is collapsed, defined if `hasChildren`
   *    hasChildren: Boolean, // if true, it has children
   *    flatName: String, // label for flat view ('/'-separated)
   *    name: String, // label for the current level (single-label without parent prefixes)
   *    nameCell: HTMLTableCellElement, // reference to the `<td>` element that contains the rowheader hierarchical label/name,
   *    block: String, // id of the block the row belongs to
   *    firstInBlock: Boolean, // whether the row is the first in this block, which meatns it has an extra cell at the beginning
   *    id: String, // item id from Reportal table
   *    level: Number, // hierarchy level
   *    parent: String, // parent id of the nested level
   *    row: HTMLTableRowElement // reference to the `tr` element in the table
   * }
   * ```
   *
   * @param {Array} hierarchy=this.hierarchy - array of hierarchy objects from Reportal
   * @param {int} level=0 - depth of the function
   * @param {String} block=null - an item from `blocks` array
   * @param {Array} array=[] - changedTable for children level
   * @return {Array}
   */
  parseHierarchy({hierarchy=this.hierarchy,level=0,rows,block,array=[],parent=null}={}){
    let blockName = block && block!==null? block.name.toLowerCase() : null,
        blockRowIndex =  block && block!==null? block.cell.parentNode.rowIndex : null;
    hierarchy.forEach((levelItem)=>{ //{text:String, isTotal:Boolean,subcells:Array}
      if((levelItem.isTotal == "True" && ((array.length == rows.length-1 && parent==null) || array.length==0)) || levelItem.isTotal!="True"){
        let row = rows[array.length];
        let firstInBlock = block!==null && row.rowIndex === blockRowIndex; //this row is first in the block, which means it contains the first cell as a block cell and we need to indent the cell index when changing names in hierarchical column
        //we need to push to the array before we add arrows/circles to labels so that we have clean labels in array and may sort them as strings
        array.push(
          [].slice.call(row.children).reduce(
            (rowArray,current)=>{
            if(!(firstInBlock && current == block.cell)){
              rowArray.push(current.children.length == 0 ? this.constructor._isNumber(current.textContent.trim()) : current.innerHTML)
            }
            return rowArray;
          },[])
        );
        let currentRowArray = array[array.length - 1];

      //build a prototype for a row
      currentRowArray.meta = this.setupMeta({
        row,
        block: block,
        firstInBlock,
        parent: parent,
        name: decodeURIComponent(levelItem.text),
        flatName: decodeURIComponent(levelItem.text),
        nameCell: row.children.item(block!==null ? (firstInBlock? this.column: this.column-1) : this.column),
        level,
        hasChildren: levelItem.hasOwnProperty('subcells')
      });

      currentRowArray.meta.flatName=this.composeFlatParentName(currentRowArray.meta);

      currentRowArray.meta.hasChildren = levelItem.hasOwnProperty('subcells');

      row.classList.add("level" + level.toString());

      if (level > 0) {
        currentRowArray.meta.hidden = true;
        this.constructor.clearLink(row);
      }
        currentRowArray.meta.collapsed = currentRowArray.meta.hasChildren;

      // we want to add the child to the parent for quick access to all childrent of the parent
      if(currentRowArray.meta.parent!=null){
        currentRowArray.meta.parent.meta.children.push(currentRowArray);
      }

      // adds a toggle button
      this.constructor.addCollapseButton(currentRowArray.meta);
      // initializes row headers according to `this.flat`
      this.updateCategoryLabel(currentRowArray);


      if (currentRowArray.meta.hasChildren) {
        this.parseHierarchy({hierarchy: levelItem.subcells, level: level + 1, array, block, rows, parent:currentRowArray})
      }
    }
  });
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
   * Removes a drilldown link from elements that are the lowest level of hierarchy and don't need it
   * @param {HTMLTableRowElement} row - row element in the table
   * */
    static clearLink(row){
      var link = row.querySelector("a");
      if(link) {
        link.parentElement.textContent = link.textContent;
      }
    }

  /**
   * function to add button to the left of the rowheader
   * @param {Object} meta - meta for the row element in the table
   */
  static addCollapseButton(meta){
    var collapseButton = document.createElement("div");
    collapseButton.classList.add("reportal-collapse-button");

    collapseButton.addEventListener('click', () => {meta.collapsed = !meta.collapsed;});

    meta.nameCell.insertBefore(collapseButton,meta.nameCell.firstChild);
    meta.nameCell.classList.add('reportal-hierarchical-cell');
  }

  static newEvent(name){
    //TODO: refactor this code when event library is added
    var event = document.createEvent('Event');
    // Define that the event name is `name`.
    event.initEvent(name, true, true);
    return event;
  }

  /**
   * function to hide or show child rows
   * @param {Object} meta - meta for the row element in the table
   */
  toggleHiddenRows(meta){
    if(meta.hasChildren){
      meta.children.forEach(childRow=>{
        if(meta.collapsed){                                           // if parent (`meta.row`) is collapsed
          childRow.meta.hidden=true;                                  // hide all its children and
          if(childRow.meta.hasChildren && !childRow.meta.collapsed){  // if a child can be collapsed
            childRow.meta.collapsed=true;                             // collapse it and
            this.toggleHiddenRows(childRow.meta);                     // repeat for its children
          }
        } else {                                                      // otherwise make sure we show all children of an expanded row
          childRow.meta.hidden=false;
        }
      });
    }
  }

  /**
   * This function runs through the data and looks for a match in `row.meta.flatName` (for flat view) or `row.meta.name` (for tree view) against the `str`.
   * @param {String} str - expression to match against (is contained in `this.search.query`)
   * */
  searchRowheaders(str){
    let regexp = new RegExp(`(${str})`,'i');
    this.data.forEach((block,blockIndex)=>{
      block.forEach(row=>{
        if(this.flat){
          row.meta.matches = regexp.test(row.meta.flatName);
          row.meta.hidden=false;
        } else {
          // if it has a parent and maybe not matches and the parent has match, then let it and its children be displayed
          if(row.meta.parent !=null && !regexp.test(row.meta.name) && row.meta.parent.meta.matches){
              // just in case it's been covered in previous iteration
              if(!row.meta.matches){row.meta.matches=true}
              row.meta.hidden=row.meta.parent.meta.collapsed;
          } else { // if has no parent or parent not matched let's test it, maybe it can have a match, if so, display his parents and children
              let matches = regexp.test(row.meta.name);
              row.meta.matches = matches;
              if(matches){
                  this.uncollapseParents(row.meta);
              }
          }
        }
      });
    });
    this.search.highlight.apply(str);
  }

  /*
  * Collapses all rows which were previously uncollapsed
  * **/
  collapseAll(){
    this.data.forEach(block=>{
      block.forEach(row=>{
        let collapsed = row.meta.collapsed;
        if(typeof collapsed != undefined && !collapsed){
          row.meta.collapsed=true;
        }
      });
    });
  }

  /**
   * Uncollapses the immediate parents of a row which `meta` is passed as an attribute. Utility function for serach to uncollapse all parents of a row that was matched during search
   * @param {Object} meta - `row.meta` object. See {@link HierarchyTable#setupMeta} for details
   * */
  uncollapseParents(meta){
    if(meta.parent!=null){ // if `parent` String is not empty - then it's not top level parent.
      if(meta.parent.meta.collapsed){meta.parent.meta.collapsed=false}
      meta.parent.meta.row.classList.add('matched-search');
      this.uncollapseParents(meta.parent.meta);
    }
  }
  /**
   * Creates a full flat name for a hierarchical level by concatenating `name` with `meta.parent.name` via a `delimiter`
   * @param {Object} meta - meta data of the row
   * @param {String=} [name=meta.name] - initial name to start with
   * @param {String=} [delimiter='|'] - delimiter to separate flattened labels from each other
   * @return {String} Returns a flat name starting with top level of hierarchy
   * */
  composeFlatParentName(meta, name=meta.name, delimiter='|'){
    var newName=name;
    if(meta.parent!=null){
      newName = this.composeFlatParentName(meta.parent.meta, [meta.parent.meta.name, delimiter, newName].join(' '));
    }
    return newName
  }

}
export default HierarchyParser;
