import type { Block } from './model'

export function TechnicalTable({block}:{block:Extract<Block,{type:'metric_table'}>}){
  return <table className="nested-table"><caption>{block.title}</caption>{block.grid?<tbody>{block.grid.map((row,index)=><tr key={index}>{row.map((cell,ci)=><td key={ci} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>{cell.blocks.length?cell.blocks.map((child,bi)=>child.type==='paragraph'?<p key={bi}>{child.text}</p>:<TechnicalTable key={bi} block={child}/>):cell.text}</td>)}</tr>)}</tbody>:<><thead><tr>{block.columns.map((column,index)=><th key={index}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row,index)=><tr key={index}>{row.map((value,ci)=><td key={ci}>{value}</td>)}</tr>)}</tbody></>}</table>
}
