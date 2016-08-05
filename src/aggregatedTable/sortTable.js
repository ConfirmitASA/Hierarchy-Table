/**
 * Created by IvanP on 26.07.2016.
 */

class SortTable{
  /**
   * Makes a table sortable, gives API for sorting. It sorts `data` array, but doesn't move rows in the `source` table, because of differences in implementation
   * @param {Boolean} enabled=false - enables sorting on a header of a table
   * @param {HTMLTableElement} source - source table sorting will be applied to
   * @param {HTMLTableElement} [auxHeader] - the floating header if any, will reflect and trigger sorting on header when scrolled.
   * @param {Number} [defaultHeaderRow=-1] - index of the row in `thead` (incremented from 0) that will have sorting enabled for columns. If `-1` then last row.
   * @param {Array} [columns] - Array of column indices (incremented from 0) that will have sorting enabled. If not specified, all columns will be sortable. Optionally `excludedColumns` can be specified instead as a shorthand to pass only indices of columns to be excluded from sorting, assumning that others will be made sortable
   * @param {Array} [excludedColumns] - Array of column indices (incremented from 0) that will be excluded from sorting. Can be used as a shorthand instead of `columns`.
   * @param {Object} [defaultSorting] - an array of objects that specify default sorting
   * @param {Number} defaultSorting.column - column index
   * @param {String} defaultSorting.direction - sort direction (`asc`|`desc`)
   * @param {Array} data - data with information for rows to be sorted
   * */
  constructor({enabled=false,source,auxHeader,defaultHeaderRow=-1,columns,excludedColumns,defaultSorting=[],data=[]}={}){
    let event = document.createEvent('Event');
    event.initEvent('reportal-table-sort', true, true);
    this._sortEvent = event;

    this.enabled=enabled;
    this.source=source;
    this.data = data;
    // calculate default header row
    let headerRows = source.querySelector('thead').children,
        auxHeaderRows = auxHeader?auxHeader.querySelector('thead').children:null,
        headerRowIndex = defaultHeaderRow==-1?headerRows.length+defaultHeaderRow:defaultHeaderRow;
    this.defaultHeaderRow={index:headerRowIndex, row:headerRows.item(headerRowIndex), auxRow:auxHeaderRows?auxHeaderRows.item(headerRowIndex):null};

    this.sortOrder = [];//necessary for proper initialization of `columns`
    this.columns=this.setupColumns(columns, excludedColumns);

    // setup sort order and do initial default sorting
    this.sortOrder = this.setupSortOrder(defaultSorting);

    this.sort(); //initial sorting if any
  }

  /**
   * Creates a `sortOrder` array with utility functions `add`,`remove`,`replace`
   * @param {Object} defaultSorting - an array of objects that specify default sorting
   * @param {Number} defaultSorting.column - column index
   * @param {String} defaultSorting.direction - sort direction (`asc`|`desc`)
   * @return {Array}
   * */
  setupSortOrder(defaultSorting){
    var sortOrder = [];
    var self = this;
    /**
     * Replaces all items in sort order
     * @param {{column:Number,direction:String}} obj - object describing sorting
     * @param {Number} obj.column - column index
     * @param {String} obj.direction - sort direction (`asc`|`desc`)
     * */
    sortOrder.replace = function(obj){
      if(this.length>0){
        this.forEach((item,index)=>{
          this.remove(index,item.column);
        });
      }
      this.add(obj);
      self.sort();
    };

    /**
     * Adds another column to be sorted
     * @param {{column:Number,direction:String}} obj - object describing sorting
     * @param {Number} obj.column - column index
     * @param {String} obj.direction - sort direction (`asc`|`desc`)
     * */
    sortOrder.add = function(obj){
      self.columns[obj.column].cell.classList.add('sorted',obj.direction);
      if(self.columns[obj.column].auxCell)self.columns[obj.column].auxCell.classList.add('sorted',obj.direction);
      sortOrder.push(obj);
    };

    /**
     * Removes a column from `sortOrder`
     * @param {Number} index - index of item in `sortOrder` array to be removed
     * @param {Number} column - column index as reference to the item to be removed.
     * */
    sortOrder.remove = function(index,column){
      self.columns[column].cell.classList.remove('sorted','asc','desc');
      if(self.columns[column].auxCell)self.columns[column].auxCell.classList.remove('sorted','asc','desc');
      this.splice(index,1);
    };

    if(defaultSorting.length>0){
      defaultSorting.forEach(item=>sortOrder.add(item));
    }

    return sortOrder;
  }

  /**
   * Creates an array of objects corresponding to the cells of `defaultHeaderRow`, that contain `sortable` property, denoting the column is sortable, `index` of the column and reference to the `cell`. Adds `.sortable` to a sortable cell
   * @return {{sortable:Boolean, index:Number, cell: HTMLTableCellElement}} - an array of objects that have this structure
   * */
  setupColumns(columns,excluded){
    var headerRows = this.source.querySelector('thead').children;
    if(headerRows.length==0){console.warn(`Sorting is impossible because table#${source.id} doesn't have headers`);return;}
    let headerColumns = [].slice.call(this.defaultHeaderRow.row.children);
    if(headerRows.length>1 && headerRows.item(0).children.item(0).rowSpan>1){ // if there is more than one row in header and if the first header has a cell with rowspan, add it to the array
      headerColumns.unshift(headerRows.item(0));
    }
    if(this.defaultHeaderRow.auxRow){
      var auxHeaderRows = this.defaultHeaderRow.auxRow.parentNode.children;
      var auxHeaderColumns = [].slice.call(this.defaultHeaderRow.auxRow.children);
      if(headerRows.length>1 && headerRows.item(0).children.item(0).rowSpan>1){
        auxHeaderColumns.unshift(auxHeaderRows.item(0));
      }
    }
    var realColumnIndex=0;
    return headerColumns.map((cell,index)=>{
        let sortable = (!(columns && columns.indexOf(cell.cellIndex)==-1) || (excluded && excluded.indexOf(index)==-1)); // is in columns and not in excluded,
        if(sortable){
          cell.addEventListener('click',(el)=>{
            if(el.target.localName =='td'||el.target.localName =='th'){this.updateSorting(el.target);} //we want to capture click on the cell and not buttons in it
          });
          cell.classList.add('sortable');
          if(auxHeaderColumns){
            var auxCell = auxHeaderColumns[index];
            auxCell.addEventListener('click',(el)=>{
              if(el.target.localName =='td'||el.target.localName =='th'){this.updateSorting(el.target);} //we want to capture click on the cell and not buttons in it
            });
            auxCell.classList.add('sortable');
          }

        }
        let _sorted = null,
          self = this;
       var obj = {
         sortable:sortable,
         get sorted(){return _sorted},
         set sorted(val){
           _sorted = val;
           if(val){
             this.cell.classList.add('sorted');
             this.auxCell?this.auxCell.classList.add('sorted'):null;
           } else {
             this.cell.classList.remove('sorted','asc','desc');
             this.auxCell?this.auxCell.classList.remove('sorted','asc','desc'):null;
           }
         },
         index: realColumnIndex,
         cell: cell,
         auxCell: auxCell
       };
       if(cell.colSpan>1){
         realColumnIndex= realColumnIndex + cell.colSpan;
       } else {realColumnIndex++}
       return obj;
    });
  }

  /**
   * Performs sorting. Can sort two columns if `sortOrder` has two items, the first of which has priority.
   * @return {Event} - `reportal-table-sort` event
   * */
  sort(){
    if(this.sortOrder && this.sortOrder.length>0){
      this.data.forEach((block,index,array)=>{
      block.sort((a, b)=>{ // sort rows
          if(this.sortOrder.length>1){
            return this.constructor.sorter(a[this.columns[this.sortOrder[0].column].index],b[this.columns[this.sortOrder[0].column].index], this.sortOrder[0].direction === 'desc' ? -1 : 1) || this.constructor.sorter(a[this.columns[this.sortOrder[1].column].index],b[this.columns[this.sortOrder[1].column].index], this.sortOrder[1].direction === 'desc' ? -1 : 1)
          } else {
            return this.constructor.sorter(a[this.columns[this.sortOrder[0].column].index],b[this.columns[this.sortOrder[0].column].index], this.sortOrder[0].direction === 'desc' ? -1 : 1);
          }
        });
      });
      this.columns[this.sortOrder[0].column].cell.dispatchEvent(this._sortEvent);
    }
  }

  /**
   * Updates `sortOrder` with the clicked cell
   * @param {HTMLTableCellElement} cell - the cell that was clicked
   * */
  updateSorting(cell){
    if(!cell.classList.contains('sorted')){ // this column is not sorted, there might be others that are.
      this.sortOrder.replace({column:cell.cellIndex, direction: 'asc'});
    } else { //swaps sorting from asc to desc
      this.sortOrder.replace({column:cell.cellIndex, direction: cell.classList.contains('asc')?'desc':'asc'});
    }
  }

  /**
   * Function that performs case insensitive sorting in the array. It can distinguish between numbers, numbers as strings, HTML and plain strings
   * */
  static sorter(a,b,lesser){
    //let x = a[idx],y = b[idx];
    let regex = /[<>]/g;
    if(regex.test(a) || regex.test(b)){ // if we need to sort elements that have HTML like links
      let tempEl1 = document.createElement('span'); tempEl1.innerHTML = a;
      a=tempEl1.textContent.trim();
      let tempEl2 = document.createElement('span'); tempEl2.innerHTML = b;
      b=tempEl2.textContent.trim();
    }
    if(!isNaN(a) && !isNaN(b)){//they might be numbers or null
      if(a===null){return 1} else if(b===null){return -1}
      return a <  b ? lesser :  a >  b ? -lesser : 0;
    }
    else if(!isNaN(parseFloat(a)) && !isNaN(parseFloat(b))){ // they might be number strings
      return parseFloat(a) <  parseFloat(b) ? lesser :  parseFloat(a) >  parseFloat(b) ? -lesser : 0;
    } else { //they might be simple strings
      return a.toLowerCase() < b.toLowerCase() ? lesser : a.toLowerCase() > b.toLowerCase() ? -lesser : 0;
    }
  }

}

export default SortTable
