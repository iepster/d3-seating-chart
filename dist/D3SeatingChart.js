"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const d3 = require("d3");
const style_inline_1 = require("./style.inline");
const showBehavior_enum_1 = require("./showBehavior.enum");
const selectionChangeEvent_model_1 = require("./selectionChangeEvent.model");
const D3SeatingChartDefaultConfig = {
    showBehavior: showBehavior_enum_1.ShowBehavior.DirectDecendants,
    allowManualSelection: true
};
class D3SeatingChart {
    constructor(element) {
        this.element = element;
        this.margin = 20;
        this.history = [];
        this.zoomChangedListeners = [];
        this.selectionChangeListeners = [];
        this.selectedElements = [];
    }
    init(config) {
        let svgSelection = d3.select(this.element);
        let gSelection = svgSelection.select('g');
        this.config = config;
        this.uniqueIdentifier = `d3sc_${Math.round(Math.random() * 10000000000)}`;
        this.element.setAttribute(this.uniqueIdentifier, '');
        let style = document.createElement('style');
        style.innerHTML = style_inline_1.InlineStyle.replace(/\{@uid\}/g, this.uniqueIdentifier);
        this.element.appendChild(style);
        this.bindEvents();
        this.zoom(gSelection, false);
    }
    stripStyles(selector) {
        let svgSelection = d3.select(this.element);
        svgSelection.selectAll(selector)
            .attr('stroke', null)
            .attr('stroke-width', null)
            .attr('fill', null);
    }
    getBoard() {
        return this.selectElement('[board]');
    }
    selectElement(query) {
        return d3.select(this.element).select(query);
    }
    selectElements(query) {
        return d3.select(this.element).selectAll(query);
    }
    goToBoard() {
        this.zoom(this.getBoard());
    }
    clearHistory() {
        this.history.length = 0;
    }
    canGoBack() {
        return !!this.history.length;
    }
    goBack() {
        this.history.pop();
        if (this.history.length) {
            this.zoom(this.history[this.history.length - 1]);
        }
        else {
            this.goToBoard();
        }
    }
    registerZoomChangeListener(fn) {
        this.zoomChangedListeners.push(fn);
        return () => {
            let idx = this.zoomChangedListeners.indexOf(fn);
            if (idx != -1) {
                this.zoomChangedListeners.splice(idx, 1);
            }
        };
    }
    registerSelectionChangeListener(fn) {
        this.selectionChangeListeners.push(fn);
        return () => {
            let idx = this.selectionChangeListeners.indexOf(fn);
            if (idx != -1) {
                this.selectionChangeListeners.splice(idx, 1);
            }
        };
    }
    zoom(selection, animate = true) {
        let scaleTransform;
        let translateTransform;
        let boardSelection = this.getBoard();
        let boundingBox = selection.node().getBBox();
        if (selection.node() !== boardSelection.node()) {
            if (selection != this.focusedElement) {
                this.history.push(selection);
            }
        }
        else {
            this.clearHistory();
        }
        this.selectElements('.focused').classed('focused', false);
        selection.classed('focused', true);
        this.focusedElement = selection;
        let all = boardSelection.selectAll(`*`);
        let activeLayer = selection.selectAll('.focused > *');
        let parentWidth = this.element.clientWidth;
        let parentHeight = this.element.clientHeight;
        let desiredWidth = parentWidth - this.margin * 2;
        let desiredHeight = parentHeight - this.margin * 2;
        let widthRatio = desiredWidth / boundingBox.width;
        let heightRatio = desiredHeight / boundingBox.height;
        let ratio = Math.min(widthRatio, heightRatio);
        scaleTransform = `scale(${ratio})`;
        let newX = (this.element.clientWidth / 2 - boundingBox.width * ratio / 2 - boundingBox.x * ratio);
        let newY = (this.element.clientHeight / 2 - boundingBox.height * ratio / 2 - boundingBox.y * ratio);
        translateTransform = `translate(${newX},${newY})`;
        let currentTransform = selection.attr('transform');
        if (!currentTransform) {
            currentTransform = 'translate(0, 0)scale(1)';
        }
        if (this.config.showBehavior !== showBehavior_enum_1.ShowBehavior.All) {
            let hideList = this.getHideList(selection);
            let showList = this.getShowList(selection);
            hideList
                .style('opacity', 1)
                .transition()
                .duration(animate ? 300 : 0)
                .style('opacity', 0);
            showList.transition()
                .style('opacity', 0)
                .duration(animate ? 300 : 0)
                .style('opacity', 1);
        }
        boardSelection.transition()
            .duration(animate ? 300 : 0)
            .attr('transform', `${translateTransform}${scaleTransform}`);
        let tmpListeners = this.zoomChangedListeners.concat([]);
        tmpListeners.forEach((listener) => {
            listener();
        });
    }
    getShowList(selection) {
        if (this.config.showBehavior === showBehavior_enum_1.ShowBehavior.AllDecendants) {
            return selection.selectAll('.focused *');
        }
        else {
            return selection.selectAll('.focused > *');
        }
    }
    getHideList(selection) {
        let boardSelection = this.getBoard();
        let all = boardSelection.selectAll(`*`);
        let children;
        if (this.config.showBehavior === showBehavior_enum_1.ShowBehavior.AllDecendants) {
            children = selection.selectAll('.focused *');
        }
        else {
            children = selection.selectAll('.focused > *');
        }
        return d3.selectAll(all.nodes().filter((a) => {
            return a != boardSelection.node() && a != selection.node() && children.nodes().indexOf(a) == -1 && (a.style.opacity === '' || a.style.opacity === '1');
        }));
    }
    refresh() {
        this.zoom(this.focusedElement, false);
    }
    bindEvents() {
        let self = this;
        this.selectElements('[zoom-control]').on('click', (d) => {
            let ele = d3.event.srcElement;
            let expose = ele.getAttribute('zoom-control');
            if (expose) {
                this.zoom(this.selectElement(`[zoom-target="${expose}"]`));
            }
        });
        if (this.config.allowManualSelection) {
            this.selectElements('[seat]').on('click', function () {
                let selectionsChanged = false;
                let ele = this;
                if (!ele.hasAttribute('locked')) {
                    selectionsChanged = true;
                    if (ele.hasAttribute('selected')) {
                        self.selectedElements.splice(self.selectedElements.findIndex(x => x === ele), 1);
                        ele.removeAttribute('selected');
                    }
                    else {
                        self.selectedElements.push(ele);
                        ele.setAttribute('selected', '');
                    }
                }
                if (selectionsChanged) {
                    self.emitSelectionChangeEvent(selectionChangeEvent_model_1.SelectionChangeEventReason.SelectionChanged);
                }
            });
        }
    }
    lock(ele, c = '', emitEvents = true) {
        let selectionChanges = false;
        ele = this.resolveElements(ele);
        ele.forEach((e) => {
            if (!e.hasAttribute('locked') || e.getAttribute('locked') != c) {
                e.setAttribute('locked', c);
                if (e.hasAttribute('selected')) {
                    e.removeAttribute('selected');
                    selectionChanges = true;
                }
            }
        });
        if (emitEvents && selectionChanges) {
            this.emitSelectionChangeEvent(selectionChangeEvent_model_1.SelectionChangeEventReason.LockOverride);
        }
    }
    unlockAll(c = '', emitEvents = true) {
        if (c) {
            this.unlock(`[locked="${c}"]`, emitEvents);
        }
        else {
            this.unlock('[locked]', emitEvents);
        }
    }
    unlock(ele) {
        ele = this.resolveElements(ele);
        ele.forEach((e) => {
            if (e.hasAttribute('locked')) {
                e.removeAttribute('locked');
            }
        });
    }
    deselectAll(emitEvents = true) {
        this.deselect('[selected]', emitEvents);
    }
    deselect(ele, emitEvents = true) {
        let selectionChanges = false;
        ele = this.resolveElements(ele);
        ele.forEach((e) => {
            if (e.hasAttribute('selected')) {
                selectionChanges = true;
                e.removeAttribute('selected');
            }
        });
        if (emitEvents && selectionChanges) {
            this.emitSelectionChangeEvent(selectionChangeEvent_model_1.SelectionChangeEventReason.SelectionChanged);
        }
    }
    select(ele, emitEvents = true) {
        let selectionChanges = false;
        ele = this.resolveElements(ele);
        ele.forEach((e) => {
            if (!e.hasAttribute('locked')) {
                if (!e.hasAttribute('selected')) {
                    selectionChanges = true;
                    e.setAttribute('selected', '');
                }
            }
            else {
                throw new Error('Unable to select element because its locked ' + e.outerHTML);
            }
        });
        if (emitEvents && selectionChanges) {
            this.emitSelectionChangeEvent(selectionChangeEvent_model_1.SelectionChangeEventReason.SelectionChanged);
        }
    }
    emitSelectionChangeEvent(r) {
        let tmpListeners = this.selectionChangeListeners.concat([]);
        tmpListeners.forEach((listener) => {
            listener({
                reason: r,
                selection: this.selectedElements.concat([])
            });
        });
    }
    resolveElements(ele) {
        if (typeof (ele) === 'string') {
            ele = this.selectElements(ele).nodes();
        }
        else if (!(ele instanceof Array)) {
            ele = [ele];
        }
        return ele;
    }
    static attach(element, config = D3SeatingChartDefaultConfig) {
        let d3s = new D3SeatingChart(element);
        d3s.init(config);
        return d3s;
    }
}
exports.D3SeatingChart = D3SeatingChart;
//# sourceMappingURL=d3SeatingChart.js.map