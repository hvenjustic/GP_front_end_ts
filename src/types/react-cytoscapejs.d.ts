declare module 'react-cytoscapejs' {
    import { ComponentType, CSSProperties } from 'react';
    import cytoscape, { ElementDefinition, CytoscapeOptions, StylesheetStyle } from 'cytoscape';

    export interface CytoscapeComponentProps extends Partial<CytoscapeOptions> {
        elements?: ElementDefinition[];
        cy?: (cy: cytoscape.Core) => void;
        className?: string;
        style?: CSSProperties;
        stylesheet?: StylesheetStyle[] | ReadonlyArray<StylesheetStyle>;
    }

    const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
    export default CytoscapeComponent;
}



