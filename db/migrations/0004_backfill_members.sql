-- Preserve existing ownership labels and fill membership records for founder accounts already activated.
INSERT INTO project_members(project_id,user_id)
SELECT p.id,u.id FROM projects p
JOIN users u ON u.is_active=true AND u.display_name IN ('Kabir','Naushad')
WHERE (p.owner_selection='Both' OR p.owner_selection=u.display_name)
AND (p.is_private=false OR p.created_by_id=u.id)
ON CONFLICT DO NOTHING;
