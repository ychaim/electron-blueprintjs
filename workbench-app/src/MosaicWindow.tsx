import * as classNames from 'classnames';
import * as _ from 'lodash';
import * as React from 'react';
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
  DragSource,
  DragSourceMonitor,
  DropTarget,
} from 'react-dnd';

import { createDragToUpdates, getAndAssertNodeAtPathExists, MosaicContext, MosaicWindowActionsPropType, MosaicWindowContext, Separator } from 'react-mosaic-component';
import { MosaicDragItem, MosaicDropData, MosaicDropTargetPosition } from 'node_modules/react-mosaic-component/src/internalTypes';
import { MosaicDropTarget } from 'node_modules/react-mosaic-component/src/MosaicDropTarget';
import { CreateNode, MosaicBranch, MosaicDirection, MosaicKey } from 'node_modules/react-mosaic-component/src/types';

import { DEFAULT_CONTROLS_WITH_CREATION, DEFAULT_CONTROLS_WITHOUT_CREATION } from './defaultToolbarControls';

export interface MosaicWindowProps<T extends MosaicKey> {
  title: string;
  path: MosaicBranch[];
  className?: string;
  toolbarControls?: React.ReactNode;
  additionalControls?: React.ReactNode;
  additionalControlButtonText?: string;
  draggable?: boolean;
  createNode?: CreateNode<T>;
  renderPreview?: (props: MosaicWindowProps<T>) => JSX.Element;
}

export interface InternalDragSourceProps {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
}

export interface InternalDropTargetProps {
  connectDropTarget: ConnectDropTarget;
  isOver: boolean;
  draggedMosaicId: string | undefined;
}

export type InternalMosaicWindowProps<T extends MosaicKey> = MosaicWindowProps<T> &
  InternalDropTargetProps &
  InternalDragSourceProps;

export interface InternalMosaicWindowState {
  additionalControlsOpen: boolean;
}

const PURE_RENDER_IGNORE: Array<keyof InternalMosaicWindowProps<any> | 'children'> = [
  'path',
  'connectDropTarget',
  'connectDragSource',
  'connectDragPreview',
  'children',
];

export class InternalMosaicWindow<T extends MosaicKey> extends React.Component<
  InternalMosaicWindowProps<T>,
  InternalMosaicWindowState
> {
  static defaultProps: Partial<InternalMosaicWindowProps<any>> = {
    additionalControlButtonText: 'More',
    draggable: true,
    renderPreview: ({ title }) => (
      <div className="mosaic-preview">
        <div className="mosaic-window-toolbar">
          <div className="mosaic-window-title">{title}</div>
        </div>
        <div className="mosaic-window-body">
          <h4>{title}</h4>
          <span className="bp3-icon bp3-icon-application" />
        </div>
      </div>
    ),
  };

  static contextTypes = MosaicContext;

  static childContextTypes = {
    mosaicWindowActions: MosaicWindowActionsPropType,
  };

  state: InternalMosaicWindowState = {
    additionalControlsOpen: false,
  };
  context: MosaicContext<T>;

  private rootElement: HTMLElement | null;

  getChildContext(): Partial<MosaicWindowContext<T>> {
    return {
      mosaicWindowActions: {
        split: this.split,
        replaceWithNew: this.swap,
        setAdditionalControlsOpen: this.setAdditionalControlsOpen,
        getPath: this.getPath,
      },
    };
  }

  render() {
    const {
      className,
      isOver,
      renderPreview,
      additionalControls,
      connectDropTarget,
      connectDragPreview,
      draggedMosaicId,
    } = this.props;

    return connectDropTarget(
      <div
        className={classNames('mosaic-window mosaic-drop-target', className, {
          'drop-target-hover': isOver && draggedMosaicId === this.context.mosaicId,
          'additional-controls-open': this.state.additionalControlsOpen,
        })}
        ref={(element) => (this.rootElement = element)}
      >
        {this.renderToolbar()}
        <div className="mosaic-window-body">{this.props.children!}</div>
        <div className="mosaic-window-body-overlay" onClick={this.setAdditionalControlsOpen.bind(this, false)} />
        <div className="mosaic-window-additional-actions-bar">{additionalControls}</div>
        {connectDragPreview(renderPreview!(this.props))}
        <div className="drop-target-container">
          {_.values<string>(MosaicDropTargetPosition).map(this.renderDropTarget)}
        </div>
      </div>,
    );
  }

  shouldComponentUpdate(nextProps: InternalMosaicWindowProps<T>, nextState: InternalMosaicWindowState): boolean {
    return (
      !_.isEqual(_.omit(this.props, PURE_RENDER_IGNORE), _.omit(nextProps, PURE_RENDER_IGNORE)) ||
      !_.isEqual(this.state, nextState)
    );
  }

  private getToolbarControls() {
    const { toolbarControls, createNode } = this.props;
    if (toolbarControls) {
      return toolbarControls;
    } else if (createNode) {
      return DEFAULT_CONTROLS_WITH_CREATION;
    } else {
      return DEFAULT_CONTROLS_WITHOUT_CREATION;
    }
  }

  private renderToolbar() {
    const { title, draggable, additionalControls, additionalControlButtonText, connectDragSource, path } = this.props;
    const { additionalControlsOpen } = this.state;
    const toolbarControls = this.getToolbarControls();

    let titleDiv: React.ReactElement<any> = (
      <div title={title} className="mosaic-window-title">
        {title}
      </div>
    );

    const draggableAndNotRoot = draggable && path.length > 0;
    if (draggableAndNotRoot) {
      titleDiv = connectDragSource(titleDiv) as React.ReactElement<any>;
    }

    const hasAdditionalControls = !_.isEmpty(additionalControls);

    return (
      <div className={classNames('mosaic-window-toolbar', { draggable: draggableAndNotRoot })}>
        {titleDiv}
        <div className="mosaic-window-controls bp3-button-group">
          {hasAdditionalControls && (
            <button
              onClick={this.setAdditionalControlsOpen.bind(this, !additionalControlsOpen)}
              className={classNames('bp3-button bp3-minimal bp3-icon-more', {
                'bp3-active': additionalControlsOpen,
              })}
            >
              <span className="control-text">{additionalControlButtonText!}</span>
            </button>
          )}
          {hasAdditionalControls && <Separator />}
          {toolbarControls}
        </div>
      </div>
    );
  }

  private renderDropTarget = (position: MosaicDropTargetPosition) => {
    const { path } = this.props;

    return <MosaicDropTarget position={position} path={path} key={position} />;
  };

  private checkCreateNode() {
    if (this.props.createNode == null) {
      throw new Error('Operation invalid unless `createNode` is defined');
    }
  }

  private split = (...args: any[]) => {
    this.checkCreateNode();
    const { createNode, path } = this.props;
    const { mosaicActions } = this.context;
    const root = mosaicActions.getRoot();

    const direction: MosaicDirection =
      this.rootElement!.offsetWidth > this.rootElement!.offsetHeight ? 'row' : 'column';

    return Promise.resolve(createNode!(...args)).then((second) =>
      mosaicActions.replaceWith(path, {
        direction,
        second,
        first: getAndAssertNodeAtPathExists(root, path),
      }),
    );
  };

  private swap = (...args: any[]) => {
    this.checkCreateNode();
    const { mosaicActions } = this.context;
    const { createNode, path } = this.props;
    return Promise.resolve(createNode!(...args)).then((node) => mosaicActions.replaceWith(path, node));
  };

  private setAdditionalControlsOpen = (additionalControlsOpen: boolean) => {
    this.setState({ additionalControlsOpen });
  };

  private getPath = () => this.props.path;
}

const dragSource = {
  beginDrag: (
    _props: InternalMosaicWindowProps<any>,
    _monitor: DragSourceMonitor,
    component: InternalMosaicWindow<any>,
  ): MosaicDragItem => {
    // TODO: Actually just delete instead of hiding
    // The defer is necessary as the element must be present on start for HTML DnD to not cry
    const hideTimer = _.defer(() => component.context.mosaicActions.hide(component.props.path));
    return {
      mosaicId: component.context.mosaicId,
      hideTimer,
    };
  },
  endDrag: (
    _props: InternalMosaicWindowProps<any>,
    monitor: DragSourceMonitor,
    component: InternalMosaicWindow<any>,
  ) => {
    const { hideTimer } = monitor.getItem() as MosaicDragItem;
    // If the hide call hasn't happened yet, cancel it
    window.clearTimeout(hideTimer);

    const ownPath = component.props.path;
    const dropResult: MosaicDropData = (monitor.getDropResult() || {}) as MosaicDropData;
    const { mosaicActions } = component.context;
    const { position, path: destinationPath } = dropResult;
    if (position != null && destinationPath != null && !_.isEqual(destinationPath, ownPath)) {
      mosaicActions.updateTree(createDragToUpdates(mosaicActions.getRoot(), ownPath, destinationPath, position));
    } else {
      // TODO: restore node from captured state
      mosaicActions.updateTree([
        {
          path: _.dropRight(ownPath),
          spec: {
            splitPercentage: {
              $set: null,
            },
          },
        },
      ]);
    }
  },
};

const dropTarget = {};

// Each step exported here just to keep react-hot-loader happy
export const SourceConnectedInternalMosaicWindow = DragSource(
    'MosaicWindow',
  dragSource,
  (connect, _monitor): InternalDragSourceProps => ({
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
  }),
)(InternalMosaicWindow);

export const SourceDropConnectedInternalMosaicWindow = DropTarget(
    'MosaicWindow',
  dropTarget,
  (connect, monitor): InternalDropTargetProps => ({
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    draggedMosaicId: ((monitor.getItem() || {}) as MosaicDragItem).mosaicId,
  }),
)(SourceConnectedInternalMosaicWindow);

export class MosaicWindow<T extends MosaicKey = string> extends React.PureComponent<MosaicWindowProps<T>> {
  static ofType<T extends MosaicKey>() {
    return MosaicWindow as new (props: MosaicWindowProps<T>, context?: any) => MosaicWindow<T>;
  }

  render() {
    return <SourceDropConnectedInternalMosaicWindow {...this.props as InternalMosaicWindowProps<T>} />;
  }
}

// Factory that works with generics
export function MosaicWindowFactory<T extends MosaicKey = string>(
  props: MosaicWindowProps<T> & React.Attributes,
  ...children: React.ReactNode[]
) {
  const element: React.ReactElement<MosaicWindowProps<T>> = React.createElement(
    InternalMosaicWindow as React.ComponentClass<MosaicWindowProps<T>>,
    props,
    ...children,
  );
  return element;
}
