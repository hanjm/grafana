import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { Row, RowGroup } from './types';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { produce } from 'immer';
import { Space } from '../Space';

interface ResourcePickerProps {
  resourcePickerData: Pick<ResourcePickerData, 'getResourcePickerData' | 'getResourcesForResourceGroup'>;
  resourceURI: string | undefined;
  // handleSelectResource: (row: Row, isSelected: boolean) => void;

  onApply: (resourceURI: string | undefined) => void;
  onCancel: () => void;
}

const ResourcePicker = ({ resourcePickerData, resourceURI, onApply, onCancel }: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  const [rows, setRows] = useState<RowGroup>({});
  const [internalSelected, setInternalSelected] = useState<string | undefined>(resourceURI);

  useEffect(() => {
    setInternalSelected(resourceURI);
  }, [resourceURI]);

  const handleFetchInitialResources = useCallback(async () => {
    const initalRows = await resourcePickerData.getResourcePickerData();
    setRows(initalRows);
  }, [resourcePickerData]);

  useEffect(() => {
    handleFetchInitialResources();
  }, [handleFetchInitialResources]);

  const requestNestedRows = useCallback(
    async (resourceGroup: Row) => {
      // if we've already fetched resources for a resource group we don't need to re-fetch them
      if (resourceGroup.children && Object.keys(resourceGroup.children).length > 0) {
        return;
      }

      // fetch and set nested resources for the resourcegroup into the bigger state object
      const resources = await resourcePickerData.getResourcesForResourceGroup(resourceGroup);
      setRows(
        produce(rows, (draftState: RowGroup) => {
          // TODO: fix wonky types
          (draftState[resourceGroup.subscriptionId].children as RowGroup)[resourceGroup.name].children = resources;
        })
      );
    },
    [resourcePickerData, rows]
  );

  const handleSelectionChanged = useCallback((row: Row, isSelected: boolean) => {
    isSelected ? setInternalSelected(row.id) : setInternalSelected(undefined);
  }, []);

  const selectedResource = useMemo(() => {
    if (internalSelected && Object.keys(rows).length) {
      const matches = /\/subscriptions\/(?<subscriptionId>.+)\/resourceGroups\/(?<selectedResourceGroupName>.+)\/providers\/(?<cloud>.+)/.exec(
        internalSelected
      );

      if (matches && matches.groups) {
        const { subscriptionId, selectedResourceGroupName } = matches.groups;
        const allResourceGroups = rows[subscriptionId].children || {};
        const selectedResourceGroup = allResourceGroups[selectedResourceGroupName.toLowerCase()];
        const allResourcesInResourceGroup = selectedResourceGroup.children;

        if (!allResourcesInResourceGroup || Object.keys(allResourcesInResourceGroup).length === 0) {
          requestNestedRows(selectedResourceGroup);
          return {};
        }

        const matchingResource = allResourcesInResourceGroup[internalSelected];

        return {
          [internalSelected]: matchingResource,
        };
      }
    }
    return {};
  }, [internalSelected, rows, requestNestedRows]);

  const hasSelection = Object.keys(selectedResource).length > 0;

  const handleApply = useCallback(() => {
    onApply(internalSelected);
  }, [internalSelected, onApply]);

  return (
    <div>
      <NestedResourceTable
        rows={rows}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={handleSelectionChanged}
        selectedRows={selectedResource}
      />

      <div className={styles.selectionFooter}>
        <h5>Selection</h5>
        <NestedResourceTable
          noHeader={true}
          rows={selectedResource}
          requestNestedRows={requestNestedRows}
          onRowSelectedChange={handleSelectionChanged}
          selectedRows={selectedResource}
        />
        <Space v={2} />
        <Button onClick={handleApply}>Apply</Button>
        <Space layout="inline" h={1} />
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ResourcePicker;

const getStyles = (theme: GrafanaTheme2) => ({
  selectionFooter: css({
    position: 'sticky',
    bottom: 0,
    background: theme.colors.background.primary,
    paddingTop: theme.spacing(2),
  }),
});
