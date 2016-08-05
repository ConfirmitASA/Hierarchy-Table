//const Cf = require('./lib/base.js');

import Confirmit from './lib/base.js';

import Common from './commonFunctions.js';

import HierarchyParser from './aggregatedTable/HierarchyParser.js'
import FixedHeader from './aggregatedTable/FixedHeader.js';
import AggregatedHierarchyTable from './aggregatedTable/AggregatedHierarchyTable.js'

window.Reportal = {
  Confirmit,
  FixedHeader,
  Common,
  HierarchyParser,
  AggregatedHierarchyTable
};
