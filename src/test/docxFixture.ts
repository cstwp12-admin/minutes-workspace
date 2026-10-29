export const p=(value:string)=>`<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`
export const cell=(value:string,props='')=>`<w:tc><w:tcPr>${props}</w:tcPr>${p(value)}</w:tc>`
const row=(...cells:string[])=>`<w:tr>${cells.join('')}</w:tr>`
export const wrap=(value:string)=>`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${value}</w:body></w:document>`
export const fictionalMinutesXml=wrap(
  p('Delivery Meeting No. 7')+
  '<w:tbl>'+row(cell('Date'),cell('2026-10-29'),cell('Chair'),cell('Team lead'))+'</w:tbl>'+
  '<w:tbl>'+row(cell('No.'),cell('Name'),cell('Organization'))+row(cell('1'),cell('Fictional participant'),cell('Example team'))+'</w:tbl>'+
  '<w:tbl>'+row(cell('No.'),cell('Subject'),cell('Action by'),cell('Status'),cell('Deadline'))+
  row(cell('1.0'),cell('Progress'),cell(''),cell(''),cell(''))+
  row(cell('1.1'),'<w:tc>'+p('Check delivery metrics')+'<w:tbl>'+row(cell('Workstream','<w:gridSpan w:val="2"/>'),cell('Open'))+row(cell('Alpha','<w:vMerge w:val="restart"/>'),cell('10'),cell('2'))+row(cell('','<w:vMerge/>'),cell('12'),cell('1'))+'</w:tbl>'+p('a) Verify the evidence')+'</w:tc>',cell('Delivery team'),cell('Ongoing'),cell('2026-11-05'))+
  row(cell('1.1.1'),cell('Review test results'),cell('Quality team'),cell('Open'),cell(''))+
  row(cell(''),cell('Continued discussion'),cell(''),cell(''),cell(''))+'</w:tbl>'
)
