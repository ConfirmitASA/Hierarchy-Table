/**
 * Created by IvanP on 12.08.2016.
 */

import HierarchyBase from './HierarchyBase.js'

class LazyHierarchyFetch extends HierarchyBase{
  /**
   * @param {!HTMLTableElement} source - aggregated table with drilldown
   * @param {!Array} rowheaders - array of rowheader IDs in the order of rows in the `source` table
   * @param {!Number} hierarchyID - id of Hierarchy in Table Designer
   * @param {!String} hierarchyControlID - id of the Reportal Hierarchy Component instance on the page
   * @param {Number=} languageCode=9 - Language code (according to Confirmit table of language codes) of the language the hierarchy is going to be streamed in at the page load
   * @param {Number=} column=0 - Index of the column containing the hierarchy (0-based)
   * @param {Array=} [excludedRows=[]] - array of row-indices (0-based) to exclude from importing into the table for child levels (mostly related to totals or calculated rows necessary for viewing only at this level and would repeat themselves in hierarchical presentation, because parent row contains same information)
   * @param {String=} [pageStateID]
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
  constructor({source, rowheaders, hierarchyID, hierarchyControlID, languageCode=9, column=0, flat = false,search={},data=[],blocks=[],excludedRows=[], pageStateID=document.getElementById('PageStateId').value}={}){
    super();
    if(source){this.source=source;} else { throw new ReferenceError('`source` table is not specified for DynamicDrilldownFetch')}
    if(rowheaders){this.rowheaders = rowheaders;} else { throw new ReferenceError('`rowheaders` are not specified for DynamicDrilldownFetch')}
    if(hierarchyID){this.hierarchyID=hierarchyID;} else { throw new ReferenceError('`hierarchyID` is not specified for DynamicDrilldownFetch')}
    if(hierarchyControlID){this.hierarchyControlID = hierarchyControlID;} else { throw new ReferenceError('`hierarchyControlID` is not specified for DynamicDrilldownFetch')}
    this.blocks = blocks;
    console.log(excludedRows,Array.isArray(excludedRows));
    this.languageCode = languageCode;
    if(excludedRows && Array.isArray(excludedRows)){this.excludedRows=excludedRows;} else {throw new ReferenceError('`excludedRows` must be an `Array`')}
    this.column=column;
    this.pageStateID = pageStateID;
    this.dataTableID = source.querySelector('[data-table-id]').getAttribute('data-table-id');
    this.data = this.setUpBlocks(data,blocks);
    // set up event delegation to the table to listen to expanding of rows to trigger row drilldown
    this.setUpExpandListener();
    this.flat = flat;
    this.search = this.setupSearch(search);

    this.hierarchy = {};
  }

  /**
   * If `blocks` array is not empty, then we have blocks that rowspan across hierarchy instances. This function creates meta for blocks, and makes them accessible as properties in the array. Then it launches `parseHierarchy` per each block.
   * @param {Array} data - initial data if passed
   * @param {Array} blocks - array of `blocks` passed in constructor
   * */
  setUpBlocks(data,blocks){
    //if(data.length>0){return data} //if data was already passed, use it, we assume it's ready prepared
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

  parseHierarchy({level=0,rows,block,array=[],parent=null}={}){
    console.log([].slice.call(this.source.parentNode.querySelectorAll(`table#${this.source.id}>tbody>tr`)));
    [].slice.call(this.source.parentNode.querySelectorAll(`table#${this.source.id}>tbody>tr`)).forEach((row,index)=>{
      var data = this.stripRowData(row, block && block!==null && row.rowIndex === block.cell.parentNode.rowIndex);
      array.push(data);
      var id = this.rowheaders[index][0],
          parentID = parent;
      if(this.excludedRows.indexOf(index)==-1){
        this.parseHierarchyRow({row, id, parentID, data, array, level, block, parent}, true);
      }
    });

  }

  parseHierarchyRow({row, id, parentID=null, data, array, level=0,block,parent=null}={}, getChildren=false, isSecondFetch = false){
      let blockName = block && block!==null? block.name.toLowerCase() : null,
        blockRowIndex =  block && block!==null? block.cell.parentNode.rowIndex : null;

      let firstInBlock = block!==null && row.rowIndex === blockRowIndex; //this row is first in the block, which means it contains the first cell as a block cell and we need to indent the cell index when changing names in hierarchical column
      if(!isSecondFetch){

        //row.setAttribute('data-uid', id);
      row.classList.add("level" + level.toString());
      if(!data.meta){
        //build a prototype for a row
        let nameCell = row.children.item(block!==null ? (firstInBlock? this.column: this.column-1) : this.column);
        data.meta = this.setupMeta({
          row,
          id,
          block: block,
          firstInBlock,
          nameCell: nameCell,
          parent: parent,
          name: nameCell.textContent.trim(),
          flatName: nameCell.textContent.trim(),
          level
        });
        this.fixDrilldownLink(data.meta); //disable native drilldown and add our own.
      }
      // we want to add the child to the parent for quick access to all children of the parent
      if(data.meta.parent!=null){
        data.meta.parent.meta.children.push(data);
      }
      // initializes row headers according to `this.flat`
      //this.updateCategoryLabel(data);
      this.constructor.addCollapseButton(data.meta);
      this.constructor.rowIsLoading(data.meta, true);
    }
    // check for child availability
    if(getChildren) {
      // TODO:add loading progress

      let fetchChildHierarchy = this.fetchChildHierarchy(data.meta.id);
      fetchChildHierarchy.then(childHierarchy => {
        if(childHierarchy.length > 0){ // this row has children
        //TODO: add a toggle node
        // adds a toggle button
        data.meta.hasChildren = true;


        //data.meta.collapsed = true;
        //query for children of this level only
        let fetchChildRows = this.fetchChildRows(data.meta.id, data.meta.parent!=null? data.meta.parent.meta.id:null, this.dataTableID);

        fetchChildRows.then(childRows => {
          data.meta.children = [];

          // find next row after parent before which to add child rows
          let nextRow = row.nextSibling;
          while (nextRow && nextRow.nodeType != 1) {
            nextRow = nextRow.nextSibling;
          }

          childRows.forEach((childRow, index) => {
            let currentRowData = this.stripRowData(childRow, firstInBlock);

            //data.meta.children.push(currentRowData);

            array.splice(array.indexOf(data)+1+index, 0, currentRowData);
            // TODO: add row processing as above
            // append rows after parent row
            this.source.querySelector('tbody').insertBefore(childRow, nextRow);
            this.parseHierarchyRow({row: childRow, id: childHierarchy[index].id, parentID:data.meta.id, data:currentRowData, array, level: data.meta.level+1, block, parent: data});
          });
          data.meta.collapsed = true;
          this.constructor.rowIsLoading(data.meta, false);
      });

        //TODO: add listener for toggle opening to repeat process for open items
      } else {
        //TODO: add class to display empty bullet denothing there are no children
        data.meta.hasChildren = false;
        data.meta.children=null;
        this.constructor.rowIsLoading(data.meta, false);
      }

    });
    }
  }

  setUpExpandListener(){
    this.source.addEventListener('reportal-table-hierarchy-uncollapsed', e=>{
      this.data.forEach(block=>{
        let expandedRow = block.find(row=>row.meta && row.meta.row == e.target);
      if(expandedRow.meta.children.length>0 && expandedRow.meta.children[0].meta.hasChildren==undefined){ //children have never been queried for hierarchy
        expandedRow.meta.children.forEach(child=>{this.parseHierarchyRow({row: child.meta.row, data:child, array:block, level: child.meta.level, block: child.meta.block},true,true);});
      }
    })
    });
  }

  /**
   * decorator function adding a kind of spinner to the rows that are still fetching data
   * */
  static rowIsLoading(meta, display){
    display? meta.row.classList.add('reportal-row-loading'): meta.row.classList.remove('reportal-row-loading');
  }

  /**
   * Queries if each row might contain child rows by quering hierarchy for next level
   * */
  fetchChildHierarchy(id){
      let path = [
        location.origin,
        'reportal',
        'Hierarchy',
        this.constructor.getQueryVariable('ReportId'),
        this.hierarchyID,
        this.languageCode,
        'GetChildNodes'
      ];

      let query=[
        `nodeId=${id}`,
        `info=${encodeURIComponent(JSON.stringify({IsPreview:this.constructor.getQueryVariable('Preview')==='true',HierarchyControlId:this.hierarchyControlID}))}`,
        'isRepBase=false',
        'parameter=',
        `PageStateId=${this.pageStateID}`
      ];

      var hierarchyItemChildren = this.promiseRequest([path.join('/'),'?',query.join('&')].join(''));
      return hierarchyItemChildren.then(response=>{return Promise.resolve(JSON.parse(response))});
  }

  /**
   * Gets row nodes that are child to the parent row#`id`
   * @param {!String} id - rowheader id for current row
   * @param {?String} parentID - rowheader id for parent row
   * @param {!String} tableID - Reportal Aggregated Table Component id
   * @return {Promise} Returns a thenable promise which result is an array of `HTMLTableRowElement`s child to the row#`id`
   * */
  fetchChildRows(id, parentID, tableID){
    parentID = parentID!=null?parentID:id;
      let path = [
        location.origin,
        'reportal',
        'Report',
        this.constructor.getQueryVariable('ReportId'),
        'Component',
        tableID
      ];
    let query=[
      `PageId=${this.constructor.getQueryVariable('PageId')}`,
      `Preview=${this.constructor.getQueryVariable('Preview')}`,
      `PageStateId=${this.pageStateID}`,
      `pageFilters=${encodeURIComponent(JSON.stringify({}))}`,
      `customFilters=${encodeURIComponent(JSON.stringify({}))}`,
      `persNodes=${encodeURIComponent(JSON.stringify([{NodeId:id,Text:null}]))}`, // child node id
      `origNodes=${encodeURIComponent(JSON.stringify([{NodeId:parentID,Text:null}]))}` // parent node id
    ];
    var tableResult = this.promiseRequest([path.join('/'),'?',query.join('&')].join(''));
    return tableResult.then(response=>{return Promise.resolve(this.constructor.stripRowsFromResponseTable(response, this.excludedRows))});
  }

  /**
   * Strips rows from the table received
   * @param {String} response - string representation of Aggregated table
   * @return {Array} Returns an array of rows {HTMLTableRowElement}
   * */
  static stripRowsFromResponseTable(response,excludedRows){
    let hostnode = document.createElement('span');
    hostnode.innerHTML=response;
    let rows = [].slice.call(hostnode.querySelectorAll('table>tbody>tr'));
    if(excludedRows && excludedRows.length>0){
      excludedRows.reverse().forEach(index=>{
        rows.splice(index, 1);
      });
    }
    return rows;
  }

  fixDrilldownLink(meta){
    var a = meta.nameCell.querySelector('.tbl-dd-trigger');
    a.classList.remove('tbl-dd-trigger');
    a.addEventListener('click',e=>this.triggerDrilldown(meta.id));
  }

  triggerDrilldown(id){
    var hierarchyTargetID = [].slice.call(document.querySelectorAll('input[name*=_hierarchyid]')).find(input=>input.value=this.hierarchyID).id.split('_')[0];
    var nodeIdInput = document.querySelector(`#${hierarchyTargetID}_selnodeid`);
    var eventTarget = nodeIdInput.parentNode.querySelector('#__EVENTTARGET');
    nodeIdInput.value=JSON.stringify([id]);
    eventTarget.value=`${hierarchyTargetID}_trigger`;
    window.viewmode?window.viewmode.submit():null;
  }

  static getQueryVariable(variable,query)
  {
    var query = query || window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=");
      if((pair[0]).toLowerCase() == variable.toLowerCase()){return pair[1];}
    }
    return(false);
  }

  /**
   * @return {Promise} Returns a thenable promise with `XMLHttpRequest.responseText`
   * */
  promiseRequest(query){
    return new Promise((resolve,reject)=>{
        let xhr = new XMLHttpRequest();
        xhr.open('GET', query, true);
        xhr.onload = ()=>{xhr.status == 200?resolve(xhr.responseText):reject(Error(`${xhr.status}: ${xhr.statusText}`));}
        xhr.onerror = ()=>{reject(Error("Network Error"));}
        xhr.send();
    });
  }
}

export default DynamicDrilldownFetch
