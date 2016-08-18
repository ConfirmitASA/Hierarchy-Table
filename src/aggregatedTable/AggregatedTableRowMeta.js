/**
 * Created by IvanP on 17.08.2016.
 */
/**
 * @property {HTMLTableRowElement} row - reference to the `<tr>` element
 * @property {?String} id - internal Reportal id for the rowheader in the row
 * @property {!HTMLTableCellElement} nameCell - reference to the `<td>` element that contains the rowheader label/name
 * @property {String} [name=nameCell.textContent] - label of the rowheader.
 * @property {?Object} [block=null] - the block the row belongs to
 * @property {Boolean} firstInBlock - this `row` is first in the `block`, which means it contains the first cell as a block cell
 * */
class AggregatedTableRowMeta {
  /**
   * Builds a prototype for each row of an Aggregated Table
   * @param {HTMLTableRowElement} row - reference to the `<tr>` element
   * @param {?String} id - internal Reportal id for the rowheader in the row
   * @param {!HTMLTableCellElement} nameCell - reference to the `<td>` element that contains the rowheader label/name
   * @param {String=} [name=nameCell.textContent] - label of the rowheader.
   * @param {?Object} [block=null] - the block the row belongs to
   * */
  constructor({row, id=null, nameCell, name, block=null}={}){
    /*** @property {HTMLTableRowElement} row - reference to the `<tr>` element*/
    this.row = row;
    this.id = id;
    this.nameCell = nameCell;
    this.name = name || nameCell.textContent.trim();
    this.block = block;
    this.firstInBlock = block!=null && this.row.rowIndex === this.block.cell.parentNode.rowIndex;
  }
}
export default AggregatedTableRowMeta
