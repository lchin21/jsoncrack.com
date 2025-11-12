import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, TextInput } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Helper function to update JSON at a specific path
const updateJsonAtPath = (json: string, path: (string | number)[], newValues: Record<string, string>): string => {
  try {
    const obj = JSON.parse(json);
    let current = obj;

    // Navigate to the target object
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }

    // Update the values
    if (typeof current === "object" && current !== null) {
      Object.entries(newValues).forEach(([key, value]) => {
        current[key] = value;
      });
    }

    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error("Error updating JSON:", error);
    return json;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const setContents = useFile(state => state.setContents);
  const getContents = useFile(state => state.getContents);
  const getFormat = useFile(state => state.getFormat);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (nodeData && isEditing) {
      // Initialize edited values from the current node data
      const initialValues: Record<string, string> = {};
      nodeData.text?.forEach(row => {
        if (row.type !== "array" && row.type !== "object" && row.key) {
          initialValues[row.key] = String(row.value ?? "");
        }
      });
      setEditedValues(initialValues);
    }
  }, [isEditing, nodeData]);

  const handleEditChange = (key: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!nodeData) return;

    try {
      // Update the selected node with new values
      const updatedText = nodeData.text.map(row => {
        if (row.type !== "array" && row.type !== "object" && row.key && editedValues[row.key] !== undefined) {
          return {
            ...row,
            value: editedValues[row.key],
          };
        }
        return row;
      });

      const updatedNode: NodeData = {
        ...nodeData,
        text: updatedText,
      };

      // Get the current content and format
      const currentContents = getContents();
      const currentFormat = getFormat();

      // Update the underlying JSON data
      const updatedJson = updateJsonAtPath(currentContents, nodeData.path ?? [], editedValues);

      // Update the file contents which will trigger conversion and update all formats
      setContents({ 
        contents: updatedJson, 
        hasChanges: true, 
        skipUpdate: false,
        format: currentFormat
      });

      // Update the selected node in the store
      setSelectedNode(updatedNode);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving changes:", error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedValues({});
  };

  if (!nodeData) return null;

  const editableRows = nodeData.text?.filter(
    row => row.type !== "array" && row.type !== "object"
  ) ?? [];

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Flex justify="space-between" align="center">
          <Text fz="xs" fw={500}>
            Content
          </Text>
          <Flex gap="sm">
            {!isEditing ? (
              <Button
                variant="default"
                onClick={() => setIsEditing(true)}
                disabled={editableRows.length === 0}
                size="xs"
              >
                Edit
              </Button>
            ) : (
              <>
                <Button variant="default" onClick={handleCancel} size="xs">
                  Cancel
                </Button>
                <Button onClick={handleSave} size="xs">
                  Save
                </Button>
              </>
            )}
            <CloseButton onClick={onClose} />
          </Flex>
        </Flex>

        <Stack gap="xs">
          {!isEditing ? (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          ) : (
            <Stack gap="sm" maw={600}>
              {editableRows.map((row, index) => (
                <TextInput
                  key={`${row.key}-${index}`}
                  label={row.key || "Value"}
                  value={editedValues[row.key ?? `value-${index}`] ?? ""}
                  onChange={e =>
                    handleEditChange(row.key ?? `value-${index}`, e.currentTarget.value)
                  }
                  placeholder={`Enter ${row.key || "value"}`}
                />
              ))}
            </Stack>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
