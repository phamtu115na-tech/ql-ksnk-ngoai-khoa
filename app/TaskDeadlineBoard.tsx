'use client';
import {useEffect,useState} from 'react';
import {BOARD_COLUMNS,taskColumn,vietnamDay,type BoardTask,type BoardColumn} from '../lib/task-board';

export default function TaskDeadlineBoard({rows,onEdit}:{rows:BoardTask[];onEdit:(row:BoardTask)=>void}) {
  const [today,setToday]=useState(vietnamDay);
  useEffect(()=>{const id=setInterval(()=>setToday(vietnamDay()),60000);return()=>clearInterval(id);},[]);
  const groups={overdue:[],today:[],week:[],nextWeek:[],fortnight:[],later:[],noDate:[],done:[]} as Record<BoardColumn,BoardTask[]>;
  for(const row of rows)groups[taskColumn(row,today)].push(row);
  return <section className="deadline-board" aria-label="Bảng công việc theo thời hạn">
    <div className="deadline-board-caption"><div><strong>BẢNG THỜI HẠN</strong><p>{rows.length} công việc theo bộ lọc hiện tại · Nhấn vào thẻ để xem và cập nhật</p></div><span>Hôm nay: {today.split('-').reverse().join('/')} · Giờ Việt Nam</span></div>
    <div className="deadline-board-scroll" tabIndex={0} aria-label="Cuộn ngang để xem các cột thời hạn">
      {BOARD_COLUMNS.map(column=><section className="deadline-column" key={column.id} aria-label={column.label}>
        <h3 style={{background:column.color}}><span>{column.label}</span><b>{groups[column.id].length}</b></h3>
        <div className="deadline-column-cards">
          {groups[column.id].length===0?<p className="deadline-empty">Không có công việc</p>:groups[column.id].map((row,index)=><button type="button" key={row.row_no??row.id??index} className={'deadline-card '+(column.id==='overdue'?'deadline-card-overdue':'')} onClick={()=>onEdit(row)}>
            <span className="deadline-card-title">{row.title||'Chưa có tiêu đề'}</span>
            {row.description&&<span className="deadline-description">{row.description}</span>}
            <span className="deadline-tags"><span>{column.id==='done'?'✓ Đã hoàn thành':row.endDate?`Hạn: ${row.endDate.slice(0,10).split('-').reverse().join('/')}`:'Không có hạn chót'}</span>{row.priority&&<span>{row.priority}</span>}</span>
            {row.workType&&<span className="deadline-worktype">{row.workType}</span>}
            <span className="deadline-person"><span className="deadline-avatar" aria-hidden="true">{(row.assignee||'?').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('')}</span><span><b>{row.assignee||'Chưa giao'}</b><small>{row.department||'Chưa chọn bộ phận'}</small></span></span>
            <span className="deadline-card-footer">{row.status||'Chưa bắt đầu'}{row.approvalStatus&&<small>{row.approvalStatus}</small>}</span>
          </button>)}
        </div>
      </section>)}
    </div>
    <p className="deadline-board-note">Tuần tính từ thứ Hai đến Chủ nhật. Mỗi việc chỉ xuất hiện một cột; “Hạn trong 2 tuần” gồm các hạn còn lại trong 14 ngày tới sau nhóm tuần sau.</p>
  </section>;
}
