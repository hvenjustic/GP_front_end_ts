declare module 'react-cytoscapejs' {
    import { ComponentType, CSSProperties } from 'react';
    import cytoscape, { ElementDefinition, CytoscapeOptions } from 'cytoscape';

    export interface CytoscapeComponentProps extends Partial<CytoscapeOptions> {
        elements?: ElementDefinition[];
        cy?: (cy: cytoscape.Core) => void;
        className?: string;
        style?: CSSProperties;
    }

    const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
    export default CytoscapeComponent;
}




