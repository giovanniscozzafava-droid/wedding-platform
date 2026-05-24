-- Allow IMPERIALE shape on event_tables
alter table event_tables drop constraint if exists event_tables_shape_check;
alter table event_tables
  add constraint event_tables_shape_check
  check (shape in ('ROUND','SQUARE','RECT','HEAD','IMPERIALE'));
