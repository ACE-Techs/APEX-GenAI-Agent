create sequence task_seq;

create table task (
  task_id        number default on null task_seq.nextval,
  task_name      varchar2(100 char) not null, 
  customer_name  varchar2(100 char) not null,
  due_date       date not null,
  done_at        date,
  constraint task_pk primary key (task_id)
);
