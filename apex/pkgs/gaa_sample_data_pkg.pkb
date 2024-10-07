create or replace package body gaa_sample_data_pkg as
  
  procedure recreate_tasks
  as
  begin
    execute immediate 'truncate table task';

    insert into task (task_name, customer_name, due_date, done_at)
    select task_name, 
           customer_name,
           trunc(sysdate) + round(dbms_random.value(0,4)) as due_date,
           case when dbms_random.value() < 0.3 then trunc(sysdate) else null end as done_at
    from (
      select distinct task_name, customer_name from (
        select
        case round(dbms_random.value(1,20)) 
          when 1 then 'Deliver shipment'
          when 2 then 'Pick up package'
          when 3 then 'Schedule delivery'
          when 4 then 'Process return'
          when 5 then 'Dispatch driver'
          when 6 then 'Confirm appointment with '
          when 7 then 'Resolve claim'
          when 8 then 'Reroute shipment'
          when 9 then 'Expedite order'
          when 10 then 'Reschedule delivery'
          when 11 then 'Refund order'
          when 12 then 'Track package'
          when 13 then 'Cancel shipment'
          when 14 then 'Invoice customer '
          when 15 then 'Collect payment'
          when 16 then 'Onboard new client '
          when 17 then 'Update address'
          when 18 then 'Verify account'  
          when 19 then 'Follow up with '
          else 'Contact customer'
        end as task_name,
        case round(dbms_random.value(1,20)) 
            when 1 then 'Acme Inc'
            when 2 then 'Beta Corp'
            when 3 then 'Gamma LLC'
            when 4 then 'Delta Co'
            when 5 then 'Epsilon Ent'
            when 6 then 'Zeta Inc'
            else 'Phi Inc'
        end as customer_name
      from dual
      connect by level <= 300
      order by dbms_random.value()
      )
    )
    fetch first 40 rows only
    ;
  end recreate_tasks;

end gaa_sample_data_pkg;
/
