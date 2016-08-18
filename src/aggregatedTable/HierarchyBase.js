/**
 * Created by IvanP on 15.08.2016.
 */
import Highlight from '../lib/Highlight.js';
import ReportalBase from '../lib/ReportalBase.js';
import AggregatedTableRowMeta from './AggregatedTableRowMeta.js';
/**
 * @namespace AggregatedTable.Hierarchy
 * */

/**
 * @memberof Hierarchy
 * @extends AggregatedTableRowMeta
 * @prop {HTMLTableRowElement} row - reference to the `<tr>` element
 * @prop {String} [flatName] - default string name ('|'-delimited) for hierarchy
 * @prop {String} name - a trimmed version of `flatName` containing label for this item without parent suffices
 * @prop {HTMLTableCellElement} nameCell - reference to the `<td>` element that contains the rowheader hierarchical label/name
 * @prop {String} block - id of the block the row belongs to
 * @prop {String} parent - internal Reportal id of parent row
 * @prop {Number} level=0 - level of hierarchy, increments form `0`
 * @prop {Boolean} hidden - flag set to hidden rows (meaning their parent is in collapsed state)
 * @prop {Boolean} collapsed - flag only set to rows which have children (`hasChildren=true`)
 * @prop {Boolean} [matches=false] - flag set to those rows which match `search.query`
 * @prop {Boolean} [hasChildren] - flag set to rows which contain children
 * @prop {Array} children - child rows if `hasChildren == true
 * */
class HierarchyRowMeta extends AggregatedTableRowMeta{
  /**
   * This function builds a prototype for each row
   * @param {HTMLTableRowElement} row - reference to the `<tr>` element
   * @param {String} [flatName] - default string name ('|'-delimited) for hierarchy
   * @param {String} name - a trimmed version of `flatName` containing label for this item without parent suffices
   * @param {HTMLTableCellElement} nameCell - reference to the `<td>` element that contains the rowheader hierarchical label/name
   * @param {String} block - id of the block the row belongs to
   * @param {String} parent - internal Reportal id of parent row
   * @param {Number} level=0 - level of hierarchy, increments form `0`
   * @param {Boolean} hidden - flag set to hidden rows (meaning their parent is in collapsed state)
   * @param {Boolean} collapsed - flag only set to rows which have children (`hasChildren=true`)
   * @param {Boolean} [matches=false] - flag set to those rows which match `search.query`
   * @param {Boolean} [hasChildren] - flag set to rows which contain children
   * @param {Array} children - child rows if `hasChildren == true
   * */
  constructor({row, id,  nameCell, name, flatName, block, parent=null, level=0, hidden, collapsed, matches=false, hasChildren, children}={}){
    super({row, id, nameCell, name, block});
    if(flatName)this.flatName = flatName;
    this.parent=parent;
    if(children)this.children=children;
    this.level=level;

    this.hasChildren=hasChildren;
    this.hidden=hidden;
    this.collapsed=collapsed;
    this.matches=matches;
  }

  get hasChildren(){return this._hasChildren}
  set hasChildren(val){
    this._hasChildren = val;
    if(typeof val!=undefined){
      if(!val){
        this.row.classList.add('reportal-no-children')
      } else {
        this.row.classList.remove('reportal-no-children');
      }
    }
  }

  get hidden(){return this._hidden}
  set hidden(val){
    this._hidden=val;
    if(typeof val!=undefined){
      if(val){
        this.row.classList.add("reportal-hidden-row")
      } else {
        this.row.classList.remove("reportal-hidden-row")
      }
    }
  }

  /**
   * @fires HierarchyRowMeta#reportal-table-hierarchy-collapsed
   * @fires HierarchyRowMeta#reportal-table-hierarchy-uncollapsed
   * */
  get collapsed(){return this._collapsed}
  set collapsed(val){
    if(typeof val != undefined && this.hasChildren){
      this._collapsed=val;
      if(val){
        this.row.classList.add("reportal-collapsed-row");
        this.row.classList.remove("reportal-uncollapsed-row");
        this.toggleHiddenRows();
        this.row.dispatchEvent(this.constructor._collapseEvent);
      } else {
        this.row.classList.add("reportal-uncollapsed-row");
        this.row.classList.remove("reportal-collapsed-row");
        this.toggleHiddenRows();
        this.row.dispatchEvent(this.constructor._uncollapseEvent);
      }
    }
  }

  get matches(){return this._matches}
  set matches(val){
    this._matches=val;
    if(val){
      this.row.classList.add("matched-search");
    } else {
      this.row.classList.contains("matched-search")?this.row.classList.remove("matched-search"):null;
      if(this.hasChildren){
        this.collapsed=true;
      }
    }
  }

  /**
   * Function to hide or show child rows of a collapsed/expanded row
   * @param {Object} meta - meta in the row
   */
  toggleHiddenRows(meta=this){
    if(meta.hasChildren){
      meta.children.forEach(childRow=>{
        if(meta.collapsed){                                           // if parent (`meta.row`) is collapsed
          childRow.meta.hidden=true;                                  // hide all its children and
          if(childRow.meta.hasChildren && !childRow.meta.collapsed){  // if a child can be collapsed
            childRow.meta.collapsed=true;                             // collapse it and
            meta.toggleHiddenRows(childRow.meta);                     // repeat for its children
          }
        } else {                                                      // otherwise make sure we show all children of an expanded row
          childRow.meta.hidden=false;
        }
      });
    }
  }

}
/**
 * Event fired on `row` when it's collapsed
 * @event HierarchyRowMeta#reportal-table-hierarchy-collapsed
 * */
HierarchyRowMeta._collapseEvent = ReportalBase.newEvent('reportal-table-hierarchy-collapsed');
/**
 * Event fired on `row` when it's expanded
 * @event HierarchyRowMeta#event:reportal-table-hierarchy-uncollapsed
 * */
HierarchyRowMeta._uncollapseEvent = ReportalBase.newEvent('reportal-table-hierarchy-uncollapsed');


/**
 * Fired when hierarchy is switched to flattened view
 * @event HierarchyBase#reportal-table-hierarchy-flat-view
 */
/**
 * Fired when hierarchy is switched to tree view
 * @event HierarchyBase#reportal-table-hierarchy-tree-view
 * */
/**
 * @memberof Hierarchy
 * @borrows HierarchyRowMeta as setupMeta
 * */
class HierarchyBase extends ReportalBase {
  /**
   * @fires HierarchyBase#reportal-table-hierarchy-flat-view
   * @fires HierarchyBase#reportal-table-hierarchy-tree-view
   * */
  constructor(){
    super();

    this._flatEvent = ReportalBase.newEvent('reportal-table-hierarchy-flat-view');
    this._treeEvent = ReportalBase.newEvent('reportal-table-hierarchy-tree-view');
    this.setupMeta=HierarchyRowMeta;
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

  /**
   * Strips row data from `row` cells and normalizes it (converts string numbers to float, etc)
   * @param {HTMLTableRowElement} row - table row to be stripped of data
   * @param {Boolean} [isBlockRow=false] - if table contains block cells that rowspan across several rows, we need to exclude those from actual data
   * @return {Array} Returns array of normalized cell values
   * */
  stripRowData(row, isBlockRow=false){
    return [].slice.call(row.children).reduce((childRows,current)=>{
        if(!isBlockRow){
          childRows.push(current.children.length == 0 ? this.constructor._isNumber(current.textContent.trim()) : (current.innerHTML).trim())
        }
        return childRows;
    },[]);
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
      this.data.forEach(block=>{block.forEach(row=>row.meta.toggleHiddenRows(row.meta))});
    }

    val?this.source.dispatchEvent(this._flatEvent):this.source.dispatchEvent(this._treeEvent)
  }
  get flat(){
    return this._flat;
  }

  /**
   * Replaces category label in the array in the hierarchical column position and in the html row through meta. Replacing it in the array is important for sorting by category.
   * @param {Array} row - an item in the `this.data` Array
   * */
  updateCategoryLabel(row){
    if(row.meta){
      let cell = row.meta.nameCell,
        // we want to make sure if there is a link (drill-down content) then we populate the link with new title, else write to the last text node.
        label = cell.querySelector('a')? cell.querySelector('a') : cell.childNodes.item(cell.childNodes.length-1),
        text = this.flat? row.meta.flatName: row.meta.name;

      // update the label in the array. Since we didn't include the block label, we need to offset it by one from the column in all cases.
      row[this.blocks.length>0? this.column-1:this.column] = text;

      // update the label in the table.
      label.nodeType==3? label.nodeValue=text : label.textContent = text;
    }
  }

  /**
   * This function takes care of repositioning rows in the table to match the `data` array in the way it was sorted and if the data is separated into blocks, then move the block piece to the first row in each data block.
   * */
  reorderRows(data,tbody=this.source.querySelector('tbody')){
    data.forEach(block=>{
      block.forEach((row,index,array)=>{
        if(row.meta ){
          if( row.meta.block!=null && index==0 && !row.meta.firstInBlock){ //block is defined and this is the first row in block (and doesn't contain block header already), we need to move block header from whatever line into this row
            let blockContainer = array.find(item=>item.meta.firstInBlock);
            blockContainer.meta.firstInBlock = false;
            row.meta.firstInBlock = true;
            row.meta.row.insertBefore(row.meta.block.cell, row.meta.row.firstChild);
          }
          tbody.appendChild(row.meta.row);
        }
      });
    });
  }

}

export default HierarchyBase
