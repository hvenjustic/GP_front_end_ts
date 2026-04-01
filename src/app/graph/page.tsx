import type { Metadata } from 'next';
import GraphClient from './GraphClient';

export const metadata: Metadata = {
  title: 'Graph | Context'
};

export default function GraphPage() {
  return <GraphClient />;
}
